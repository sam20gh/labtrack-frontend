/**
 * `lib/activityTypes.ts` is the one table four activity screens draw their type glyphs and
 * tints from, so two failures are worth pinning. Both are silent on a phone:
 *
 * - A glyph name `MaterialCommunityIcons` does not know renders as an empty box, with no
 *   error in the JS or the native log.
 * - A tint that is one of the clinical status colours would make a kind of activity read
 *   as a verdict — a red run looks like a bad run.
 */
import glyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';
import { Palette } from '@/constants/theme';
import { typeStyle } from '../activityTypes';

/** The ten the log form offers, the breakdown's `other`, and the server's `running`. */
const TYPES = [
    'walking', 'jogging', 'running', 'hiking', 'biking', 'swimming', 'yoga',
    'meditation', 'rowing', 'weightlifting', 'soccer', 'other',
];

const CLINICAL = [Palette.success, Palette.successDeep, Palette.warning, Palette.danger, Palette.alert];

describe('typeStyle', () => {
    it.each(TYPES)('draws %s with a glyph that exists', (type) => {
        expect(glyphs).toHaveProperty(typeStyle(type).icon);
    });

    it('falls back to a real glyph for a type it has never seen', () => {
        const style = typeStyle('underwater_basket_weaving');
        expect(glyphs).toHaveProperty(style.icon);
        expect(typeStyle(null)).toEqual(style);
    });

    it.each(TYPES)('never tints %s in a clinical status colour', (type) => {
        const { tint, surface } = typeStyle(type);
        expect(CLINICAL).not.toContain(tint);
        expect(CLINICAL).not.toContain(surface);
    });

    it('keeps a jog and a walk visually distinct, which Ionicons could not', () => {
        expect(typeStyle('jogging').icon).not.toBe(typeStyle('walking').icon);
        expect(typeStyle('jogging').tint).not.toBe(typeStyle('walking').tint);
    });
});
