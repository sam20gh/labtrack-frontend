/**
 * The app's toast — one renderer for every `Toast.show()` in the project.
 *
 * `react-native-toast-message` ships a white card with a coloured bar down its left edge and
 * two lines of grey system text. Every screen used it unconfigured, so a saved profile, a
 * failed payment and "no new analysis needed" all arrived as the same strip, light-only, with
 * a fixed 40pt top offset that put it under the Dynamic Island. This replaces the layout and
 * leaves the API alone: call sites keep writing `Toast.show({ type, text1, text2 })`.
 *
 * Five decisions:
 *
 * 1. **The tone is a badge, not a stripe.** A glyph in a tinted disc says success / problem /
 *    note to somebody who cannot tell the colours apart; a 4pt bar says it only in colour.
 * 2. **A failed request is `alert`, never `danger`.** `danger` is a verdict on a *result*
 *    ("your potassium is critically high"); "Could not save" is not a clinical finding, and
 *    the same red on both teaches people the colour means nothing. See `alert` in
 *    `constants/theme.ts` — the same line `components/errors/*` holds.
 * 3. **It follows the live scheme.** Drawn through `usePalette`, so Dark mode gets a dark card
 *    rather than a white slab across the top of a dark screen.
 * 4. **It can be closed.** Swipe still works, but a swipe is a gesture nobody is told about;
 *    the ✕ is the visible way out of a message somebody has already read.
 * 5. **It is felt and heard.** A notification haptic on success and error (not on info — a
 *    note is not an event), and the text is announced to VoiceOver / TalkBack, since a toast
 *    that appears where focus is not is otherwise silent to a screen-reader user.
 *
 * Mount `<ToastHost />`, never a bare `<Toast />` — a bare one draws the library default.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import {
    AccessibilityInfo,
    Platform,
    Pressable,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';

import { BodyFont, Radius, Spacing, type ThemePalette } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';

type Tone = 'success' | 'error' | 'info';

type ToneSpec = {
    icon: keyof typeof Ionicons.glyphMap;
    colour: (p: ThemePalette) => string;
    surface: (p: ThemePalette) => string;
    haptic: Haptics.NotificationFeedbackType | null;
    /** Read before the message, so a screen reader hears what kind of message it is. */
    spoken: string;
};

const TONES: Record<Tone, ToneSpec> = {
    success: {
        icon: 'checkmark-circle',
        colour: (p) => p.success,
        surface: (p) => p.successSurface,
        haptic: Haptics.NotificationFeedbackType.Success,
        spoken: 'Done',
    },
    error: {
        icon: 'alert-circle',
        colour: (p) => p.alert,
        surface: (p) => p.alertSurface,
        haptic: Haptics.NotificationFeedbackType.Error,
        spoken: 'Problem',
    },
    info: {
        icon: 'information-circle',
        colour: (p) => p.info,
        surface: (p) => p.infoSurface,
        haptic: null,
        spoken: 'Note',
    },
};

/** The widest a toast grows — a full-width strip across a tablet reads as a banner. */
const MAX_WIDTH = 480;

function AppToast({ type, text1, text2, isVisible, hide, onPress }: ToastConfigParams<unknown>) {
    const Palette = usePalette();
    const styles = useStyles();
    const { width } = useWindowDimensions();
    // An unrecognised type is drawn as a note rather than as nothing.
    const tone = TONES[(type in TONES ? type : 'info') as Tone];
    const colour = tone.colour(Palette);

    // Keyed on the content, because the library keeps this component mounted between two
    // toasts of the same type — a second "Entry removed" must still be felt and heard.
    useEffect(() => {
        if (!isVisible) return;
        if (tone.haptic) Haptics.notificationAsync(tone.haptic).catch(() => {});
        // Android reads the live region below; announcing as well would read it twice.
        if (Platform.OS === 'ios') {
            AccessibilityInfo.announceForAccessibility(
                [tone.spoken, text1, text2].filter(Boolean).join('. '),
            );
        }
    }, [isVisible, tone, text1, text2]);

    return (
        <View
            style={[styles.card, { width: Math.min(width - Spacing.lg * 2, MAX_WIDTH) }]}
            accessibilityRole="alert"
            accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'}
        >
            <Pressable
                onPress={onPress}
                style={styles.body}
                accessibilityLabel={[tone.spoken, text1, text2].filter(Boolean).join('. ')}
            >
                {/* The glyph is drawn in the tone on its own tint, not white on a solid disc:
                    the dark-mode tones are lightened foregrounds, and white on them is ~2.6:1. */}
                <View style={[styles.badge, { backgroundColor: tone.surface(Palette) }]}>
                    <Ionicons name={tone.icon} size={22} color={colour} />
                </View>
                <View style={styles.copy}>
                    {!!text1 && (
                        <Text style={styles.title} numberOfLines={2}>
                            {text1}
                        </Text>
                    )}
                    {!!text2 && (
                        <Text style={styles.message} numberOfLines={4}>
                            {text2}
                        </Text>
                    )}
                </View>
            </Pressable>
            <Pressable
                onPress={() => hide()}
                hitSlop={8}
                style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
            >
                <Ionicons name="close" size={18} color={Palette.textSecondary} />
            </Pressable>
        </View>
    );
}

/**
 * Every type the app shows goes through `AppToast`. The library's own `success` / `error` /
 * `info` are overridden by key, so nothing at a call site changes.
 */
export const toastConfig: ToastConfig = {
    success: (params) => <AppToast {...params} />,
    error: (params) => <AppToast {...params} />,
    info: (params) => <AppToast {...params} />,
};

/**
 * The one way to mount the toast. The root layout carries one; a screen presented over the
 * root (a modal) needs its own, because the library keeps a stack of refs and draws on the
 * last mounted. Offset from the real safe area rather than the library's fixed 40pt.
 */
export function ToastHost() {
    const insets = useSafeAreaInsets();
    return (
        <Toast
            config={toastConfig}
            topOffset={insets.top + Spacing.sm}
            bottomOffset={insets.bottom + Spacing.lg}
            visibilityTime={4500}
        />
    );
}

const useStyles = makeStyles((Palette) => ({
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: Palette.background,
        borderRadius: Radius.xl + 2,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        // Heavier than `Shadow.card`: a toast floats over content, a card sits on the page.
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 10,
    },
    body: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        paddingLeft: Spacing.md,
        minHeight: 60,
    },
    badge: {
        width: 36,
        height: 36,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copy: {
        flex: 1,
        gap: 2,
    },
    title: {
        ...BodyFont.semibold,
        fontSize: 15,
        lineHeight: 20,
        color: Palette.text,
    },
    message: {
        ...BodyFont.regular,
        fontSize: 13,
        lineHeight: 18,
        color: Palette.textSecondary,
    },
    close: {
        width: 36,
        height: 36,
        marginTop: Spacing.md,
        marginRight: Spacing.sm,
        marginLeft: Spacing.xs,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closePressed: {
        backgroundColor: Palette.borderLight,
    },
}));
