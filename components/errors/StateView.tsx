/**
 * One screen for every state that is not the screen.
 *
 * `Design/errors.svg` draws eight of them — not found, server error, no internet,
 * maintenance, not allowed, feature locked, update required, nothing to show — and draws
 * them as *the same screen* eight times: illustration, a pill naming the state, a two-word
 * title, two lines of explanation, one filled action, one quiet one. That repetition is the
 * design. This component is it, and the eight differences live in `lib/appState.ts`.
 *
 * Six things to know before changing it:
 *
 * 1. **An error state is a screen, not a toast.** The app had thirty-odd of these rendered
 *    as `<Text style={styles.error}>{error}</Text>` — one grey line, no way out, and the
 *    server's own wording. A person who cannot see their results wants to know whether to
 *    retry, wait, or ask somebody; a sentence lifted from a stack does none of that.
 * 2. **Every state offers a way forward, and the first one is the one that can work.**
 *    `retryable` in the table decides whether "Try again" is the filled button or absent
 *    entirely. Retrying a 404 fails again identically, so not found leads with the way out
 *    instead. A screen with an illustration and no button is a nicer dead end than the grey
 *    line was, and still a dead end.
 * 3. **The illustration is decoration and is announced as such.** It carries no information
 *    the title and body do not, so it is `accessibilityElementsHidden` and the block below
 *    it is one `accessibilityRole="summary"` region. A screen reader that reads out 111
 *    unlabelled paths is worse than one that reads nothing.
 * 4. **`variant="inline"` is not a smaller screen, it is a different one.** A screen that
 *    has already drawn its header and is failing *below* it must not draw a second
 *    full-height hero pushing its own chrome off the top. Inline keeps the art at a third
 *    of the width, drops the badge, and does not stretch.
 * 5. **The art is lazy by module, not by state.** Each illustration is 40–70 KB of path
 *    data and all eight are imported here, so the bundle carries ~450 KB of geometry
 *    whichever one renders. That is the same trade every ported illustration in this app
 *    makes, and it buys a screen that works with no network at the moment the network is
 *    the thing that failed — which is exactly when a remote asset would not load.
 * 6. **`detail` is below the actions, not above them.** It is the API's own wording, and it
 *    is there so a person reporting a problem can quote something. Put it under the title
 *    and it competes with copy written for them.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import {
    FeatureLockedArt,
    MaintenanceArt,
    NoDataArt,
    NoInternetArt,
    NotAllowedArt,
    NotFoundArt,
    ServerErrorArt,
    UpdateRequiredArt,
} from '@/components/errors/art';
import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';
import type { StateDescriptor, StateKey } from '@/lib/appState';

const ART: Record<StateKey, (props: { width?: number }) => React.ReactElement> = {
    not_found: NotFoundArt,
    server_error: ServerErrorArt,
    offline: NoInternetArt,
    maintenance: MaintenanceArt,
    not_allowed: NotAllowedArt,
    locked: FeatureLockedArt,
    update: UpdateRequiredArt,
    empty: NoDataArt,
};

export type StateAction = {
    label: string;
    onPress: () => void;
    /** Ionicons glyph drawn before the label, as the kit draws on every one of its buttons. */
    icon?: string;
    /** Disables the control and dims it — used while a retry is in flight. */
    busy?: boolean;
};

type Props = {
    state: StateDescriptor;
    /** The filled button. Omitted on a state with nothing that could work. */
    primary?: StateAction;
    /** The quiet one under it. The kit's is "Contact Support" on every error frame. */
    secondary?: StateAction;
    /** `screen` fills the viewport and centres; `inline` sits in a scroll under a header. */
    variant?: 'screen' | 'inline';
    style?: ViewStyle;
};

/** The kit's illustration width on a 375pt frame, and a third of that inline. */
const ART_WIDTH = { screen: 236, inline: 150 } as const;

const StateView = ({ state, primary, secondary, variant = 'screen', style }: Props) => {
    const Art = ART[state.key];
    const inline = variant === 'inline';
    const toneColor = state.tone === 'alert' ? Palette.alert : Palette.primary;
    const toneSurface = state.tone === 'alert' ? Palette.alertSurface : Palette.primaryTint;
    const toneBorder = state.tone === 'alert' ? Palette.alertBorder : Palette.primaryPale;

    return (
        <View style={[inline ? styles.inlineRoot : styles.screenRoot, style]}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Art width={ART_WIDTH[inline ? 'inline' : 'screen']} />
            </View>

            {state.badge && !inline ? (
                <View style={[styles.badge, { backgroundColor: toneSurface, borderColor: toneBorder }]}>
                    <Ionicons name={state.badgeIcon as any} size={14} color={toneColor} />
                    <Text style={[styles.badgeLabel, { color: toneColor }]}>{state.badge}</Text>
                </View>
            ) : null}

            <View style={styles.copy} accessibilityRole="summary">
                <Text style={[styles.title, inline && styles.titleInline]}>{state.title}</Text>
                <Text style={[styles.body, inline && styles.bodyInline]}>{state.body}</Text>
            </View>

            {primary ? (
                <Pressable
                    onPress={primary.onPress}
                    disabled={primary.busy}
                    accessibilityRole="button"
                    accessibilityLabel={primary.label}
                    accessibilityState={{ disabled: !!primary.busy }}
                    style={({ pressed }) => [
                        styles.primary,
                        inline && styles.primaryInline,
                        pressed && styles.pressed,
                        primary.busy && styles.busy,
                    ]}
                >
                    {primary.icon ? <Ionicons name={primary.icon as any} size={18} color={Palette.white} /> : null}
                    <Text style={styles.primaryLabel}>{primary.label}</Text>
                </Pressable>
            ) : null}

            {secondary ? (
                <Pressable
                    onPress={secondary.onPress}
                    disabled={secondary.busy}
                    accessibilityRole="button"
                    accessibilityLabel={secondary.label}
                    hitSlop={8}
                    style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                    {secondary.icon ? (
                        <Ionicons name={secondary.icon as any} size={16} color={Palette.primary} />
                    ) : null}
                    <Text style={styles.secondaryLabel}>{secondary.label}</Text>
                </Pressable>
            ) : null}

            {state.detail ? <Text style={styles.detail}>{state.detail}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    // The kit centres the block on an 812pt frame; `justifyContent: 'center'` reproduces
    // that on every phone rather than pinning it to a measurement from one.
    screenRoot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xxxl,
    },
    inlineRoot: {
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xxl,
    },

    // 28pt tall with a 6pt radius and a 1pt ring, as the export draws it.
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs + 2,
        height: 28,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.sm,
        borderWidth: 1,
        marginTop: 44,
    },
    badgeLabel: { fontSize: 12, fontFamily: Fonts.medium },

    copy: { alignItems: 'center', marginTop: Spacing.xxl + Spacing.md },
    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    titleInline: { fontSize: 20 },
    body: {
        marginTop: Spacing.md,
        fontSize: 15,
        lineHeight: 22,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
    },
    bodyInline: { fontSize: 14, lineHeight: 20 },

    // 343×48 at a 6pt radius on a 375pt frame — i.e. the full width inside a 16pt gutter.
    primary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        alignSelf: 'stretch',
        height: 48,
        borderRadius: Radius.sm,
        backgroundColor: Palette.primary,
        marginTop: Spacing.xxl + Spacing.xs,
    },
    primaryInline: { alignSelf: 'center', paddingHorizontal: Spacing.xxl, marginTop: Spacing.xl },
    primaryLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },

    secondary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
        paddingVertical: Spacing.sm,
    },
    secondaryLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.primary },

    pressed: { opacity: 0.75 },
    busy: { opacity: 0.6 },

    detail: {
        marginTop: Spacing.xl,
        fontSize: 12,
        lineHeight: 17,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
    },
});

export default StateView;
