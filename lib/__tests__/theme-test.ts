/**
 * The dark palette is only right while three things stay true: it has every key the light
 * one has, each dark foreground still reads on the dark card, and a fill still carries white
 * text. Nothing fails to build when one of those drifts — a colour just stops being legible
 * on one person's phone at night — so they are pinned here.
 */
import { Palettes, schemed, setActiveScheme } from '@/constants/theme';

const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const { light, dark } = Palettes;

describe('the dark palette', () => {
    it('defines every key the light palette does', () => {
        expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    });

    it.each([
        'text', 'textSecondary', 'primary', 'primaryDark', 'indigo',
        'success', 'successDeep', 'warning', 'danger', 'info', 'alert',
        'teal', 'sky', 'pink', 'lime', 'orange',
    ] as const)('%s reads as text on a dark card (4.5:1)', (key) => {
        expect(contrast(dark[key], dark.background)).toBeGreaterThanOrEqual(4.5);
    });

    it.each([
        ['success', 'successSurface'], ['warning', 'warningSurface'], ['danger', 'dangerSurface'],
        ['info', 'infoSurface'], ['primary', 'primarySurface'], ['alert', 'alertSurface'],
    ] as const)('%s still reads on its own tinted surface', (fg, bg) => {
        expect(contrast(dark[fg], dark[bg])).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps muted text and control outlines at the non-text floor (3:1)', () => {
        expect(contrast(dark.textMuted, dark.background)).toBeGreaterThanOrEqual(3);
        expect(contrast(dark.borderStrong, dark.background)).toBeGreaterThanOrEqual(3);
    });
});

describe('fills', () => {
    // The whole reason the …Fill tokens exist: a dark foreground is lightened past the point
    // where white text on it is legible, so a button must not use it.
    it.each(['primaryFill', 'primaryDarkFill', 'dangerFill', 'warningFill'] as const)(
        '%s carries white text at 4.5:1 in both schemes',
        (key) => {
            expect(contrast('#FFFFFF', light[key])).toBeGreaterThanOrEqual(4.5);
            expect(contrast('#FFFFFF', dark[key])).toBeGreaterThanOrEqual(4.5);
        },
    );

    it('equal their base colour in light mode, so migrating changes nothing there', () => {
        expect(light.primaryFill).toBe(light.primary);
        expect(light.dangerFill).toBe(light.danger);
        expect(light.successFill).toBe(light.success);
        expect(light.warningFill).toBe(light.warning);
    });

    it('would fail if the dark foreground were used as a fill', () => {
        expect(contrast('#FFFFFF', dark.primary)).toBeLessThan(4.5);
    });
});

describe('schemed()', () => {
    const table = schemed((palette, scheme) => ({ ink: palette.text, scheme }));

    afterEach(() => setActiveScheme('light'));

    it('reads the active scheme at the moment of the read', () => {
        setActiveScheme('light');
        expect(table.ink).toBe(light.text);
        setActiveScheme('dark');
        expect(table.ink).toBe(dark.text);
        expect(table.scheme).toBe('dark');
    });

    it('enumerates like a plain object', () => {
        setActiveScheme('dark');
        expect(Object.keys(table)).toEqual(['ink', 'scheme']);
        expect(Object.entries(table)).toEqual([['ink', dark.text], ['scheme', 'dark']]);
        expect('ink' in table).toBe(true);
    });

    it('builds each scheme once', () => {
        const build = jest.fn((palette: typeof light) => ({ ink: palette.text }));
        const counted = schemed(build);
        setActiveScheme('light');
        void counted.ink; void counted.ink;
        setActiveScheme('dark');
        void counted.ink; void counted.ink;
        expect(build).toHaveBeenCalledTimes(2);
    });
});
