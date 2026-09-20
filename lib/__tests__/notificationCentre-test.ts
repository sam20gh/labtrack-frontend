/**
 * The client's half of the notification centre.
 *
 * Nothing here talks to the API — that is the server's contract and
 * `labtrack-backend/__tests__/notifications.test.js` holds it. What is pinned here is the
 * presentation this file owns, and every case is one that was either wrong once or is
 * wrong in the obvious implementation:
 *
 *   - the day grouping, which must follow the **server's** day string and not recompute one
 *   - the relative clock, which stops being relative before it becomes arithmetic
 *   - the chips, which must not offer a filter that can only produce an empty screen
 *   - the tint map, which must cover every tint the server can send
 */
jest.mock('../auth', () => ({ getAccessToken: jest.fn(async () => null) }));

import {
    relativeTime, dayLabel, groupByDay, chipsFor, tintOf, TINT_COLOURS,
    type NotificationCard, type NotificationCounts,
} from '../notificationCentre';

/** The local `YYYY-MM-DD` for a moment, the way the server computes it from `tzOffset`. */
const localDay = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const card = (over: Partial<NotificationCard> = {}): NotificationCard => ({
    id: Math.random().toString(36).slice(2),
    category: 'plan',
    categoryLabel: 'Health plan',
    icon: 'calendar-outline',
    tint: 'violet',
    title: 'Due today',
    body: 'Your lipid panel is due today.',
    route: '/myplans',
    meter: null,
    chip: null,
    imageUrl: null,
    actions: [],
    data: {},
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    day: localDay(new Date()),
    wasPushed: true,
    ...over,
});

describe('relativeTime', () => {
    const now = new Date('2026-09-20T12:00:00Z');

    it('counts up through minutes, hours and days', () => {
        expect(relativeTime('2026-09-20T11:59:40Z', now)).toBe('just now');
        expect(relativeTime('2026-09-20T11:35:00Z', now)).toBe('25m ago');
        expect(relativeTime('2026-09-20T09:00:00Z', now)).toBe('3h ago');
        expect(relativeTime('2026-09-18T12:00:00Z', now)).toBe('2d ago');
    });

    it('stops being relative at a week', () => {
        // "23d ago" is a number somebody has to do arithmetic on, and the one thing a
        // timestamp on a notification has to be is glanceable.
        expect(relativeTime('2026-08-28T12:00:00Z', now)).not.toMatch(/ago/);
    });

    it('never counts backwards for a clock that is slightly ahead', () => {
        // Server and handset clocks differ by seconds routinely, and "-1m ago" is the kind
        // of thing that ships.
        expect(relativeTime('2026-09-20T12:00:30Z', now)).toBe('just now');
    });

    it('returns nothing for a date it cannot read, rather than "NaN ago"', () => {
        expect(relativeTime('not-a-date', now)).toBe('');
    });
});

describe('dayLabel', () => {
    const now = new Date('2026-09-20T12:00:00Z');

    it('names today and yesterday', () => {
        expect(dayLabel(localDay(now), now)).toBe('Today');
        expect(dayLabel(localDay(new Date(now.getTime() - 86400000)), now)).toBe('Yesterday');
    });

    it('falls back to a date for anything older', () => {
        const label = dayLabel('2026-09-01', now);
        expect(label).not.toBe('Today');
        expect(label).not.toBe('Yesterday');
        expect(label).toMatch(/September|Sept|Sep|09|1/);
    });
});

describe('groupByDay', () => {
    it('makes one section per day and keeps the feed order inside it', () => {
        const sections = groupByDay([
            card({ title: 'a', day: '2026-09-20' }),
            card({ title: 'b', day: '2026-09-20' }),
            card({ title: 'c', day: '2026-09-19' }),
        ], new Date('2026-09-20T12:00:00Z'));

        expect(sections).toHaveLength(2);
        expect(sections[0].data.map((c) => c.title)).toEqual(['a', 'b']);
        expect(sections[1].data.map((c) => c.title)).toEqual(['c']);
    });

    it('uses the server\'s day string rather than recomputing one from createdAt', () => {
        // The server groups by the person's `tzOffset`; deriving the header here from
        // `createdAt` would put the section break in a different place at midnight, and the
        // two would disagree on exactly the notification that arrived at 23:50.
        const sections = groupByDay([
            card({ createdAt: '2026-09-21T01:30:00.000Z', day: '2026-09-20' }),
        ], new Date('2026-09-21T02:00:00Z'));
        expect(sections[0].day).toBe('2026-09-20');
    });

    it('calls the section `data`, which is what SectionList requires', () => {
        // A section whose array is named anything else typechecks as a plain object and
        // renders as nothing.
        expect(groupByDay([card()])[0]).toHaveProperty('data');
    });

    it('returns no sections for an empty feed rather than one empty one', () => {
        expect(groupByDay([])).toEqual([]);
    });
});

describe('chipsFor', () => {
    const counts: NotificationCounts = {
        unread: 4,
        read: 9,
        byCategory: {
            plan: { total: 6, unread: 1 },
            medication: { total: 4, unread: 3 },
            order: { total: 0, unread: 0 },
        },
    };
    const labels = { plan: 'Health plan', medication: 'Medication', order: 'Orders' };

    it('drops a category that has never produced a notification', () => {
        // A chip reading "Orders (0)" is a filter whose only possible outcome is an empty
        // screen — the dummy control this app keeps removing.
        expect(chipsFor(counts, labels).map((c) => c.key)).not.toContain('order');
    });

    it('puts the most unread first, then the biggest', () => {
        expect(chipsFor(counts, labels).map((c) => c.key)).toEqual(['medication', 'plan']);
    });

    it('falls back to the raw key when the label is unknown', () => {
        // A category the server has and this build has not seen still gets a chip, rather
        // than a blank one — the client is never the reason a notification is unreachable.
        const chips = chipsFor(counts, {});
        expect(chips.find((c) => c.key === 'plan')?.label).toBe('plan');
    });
});

describe('the icons the server can send', () => {
    /**
     * Mirrors the `icon` column of `labtrack-backend/utils/notificationCatalogue.js`.
     *
     * Vendored rather than imported, for the reason the shared types are: the two repos
     * deploy independently and EAS builds this one from its own remote, so a
     * `require('../../labtrack-backend/...')` works here and fails there. What this catches
     * is the failure that is otherwise invisible — **Ionicons renders an unknown name as
     * nothing at all**, so a typo in the server's table produces a card with an empty
     * circle where its mark should be, on every phone, with no error anywhere.
     */
    const SERVER_ICONS = [
        'calendar-outline', 'medkit-outline', 'moon-outline', 'water-outline',
        'walk-outline', 'restaurant-outline', 'pulse-outline', 'document-text-outline',
        'sparkles-outline', 'time-outline', 'cube-outline', 'trophy-outline',
        'person-outline',
    ];

    it('are all real Ionicons glyphs', () => {
        const { glyphMap } = jest.requireActual('@expo/vector-icons/Ionicons').default;
        for (const name of SERVER_ICONS) {
            expect(Object.prototype.hasOwnProperty.call(glyphMap, name)).toBe(true);
        }
    });
});

describe('the tint map', () => {
    it('covers every tint the server can send', () => {
        // Mirrors `TINTS` in `labtrack-backend/utils/notificationCatalogue.js`. A tint
        // missing here draws as slate, which is survivable, but a tint added there and
        // never added here means the category that wanted it is permanently grey.
        const serverTints = ['violet', 'indigo', 'blue', 'green', 'rose', 'amber', 'slate'];
        expect(Object.keys(TINT_COLOURS).sort()).toEqual([...serverTints].sort());
    });

    it('falls back to slate rather than to undefined', () => {
        // @ts-expect-error — deliberately passing a tint this build does not know.
        expect(tintOf('chartreuse')).toEqual(TINT_COLOURS.slate);
    });
});
