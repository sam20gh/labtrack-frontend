/**
 * The two things a screen calls.
 *
 * `StateView` is the renderer and `lib/appState.ts` is the table; almost nothing should
 * need either directly. A screen that failed to load renders `<ErrorState>`, a screen that
 * loaded nothing renders `<EmptyState>`, and both get the kit's layout, the right
 * illustration, an action that can actually work and a route to support — from one line.
 *
 * The defaults are the opinionated part:
 *
 * - **"Try again" appears only where trying again could work.** `retryable` comes off the
 *   table, so a 404 offers the way out and a 500 offers the retry. A screen can override
 *   both, but it cannot accidentally offer a retry that is guaranteed to fail.
 * - **"Contact Support" is the kit's second action on every error frame, and it goes
 *   somewhere.** `/help` is the Help Center, which carries the FAQ, the assistant and the
 *   feedback form. A quiet link to nothing is the dummy control this app keeps deleting.
 * - **Support is offered on faults, not on emptiness.** "Nothing to show yet" is not a
 *   problem anybody can help with, and inviting somebody to report it wastes their time
 *   and ours.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import StateView, { StateAction } from '@/components/errors/StateView';
import { Palette, Radius, Spacing, BodyFont } from '@/constants/theme';
import { describeError, describeState, DescribeOptions, StateKey } from '@/lib/appState';

export { default as StateView } from '@/components/errors/StateView';
export type { StateAction } from '@/components/errors/StateView';

type ErrorStateProps = DescribeOptions & {
    /** Whatever was thrown — an `ApiError`, an `Error`, or anything else. */
    error: unknown;
    /** Runs the screen's loader again. Omit it and no retry is offered. */
    onRetry?: () => void;
    /** True while a retry is in flight, so the button dims instead of double-firing. */
    retrying?: boolean;
    /** `inline` for a screen that has already drawn its own header. */
    variant?: 'screen' | 'inline';
    /** Replaces the default primary action entirely. */
    primary?: StateAction;
    /** Replaces "Contact Support". Pass `null` to draw no second action. */
    secondary?: StateAction | null;
    style?: ViewStyle;
};

export const ErrorState = ({
    error,
    subject,
    onRetry,
    retrying,
    variant,
    primary,
    secondary,
    style,
}: ErrorStateProps) => {
    const router = useRouter();
    const state = describeError(error, { subject });

    const retry: StateAction = {
        label: 'Try again',
        icon: 'refresh-outline',
        onPress: onRetry ?? (() => {}),
        busy: retrying,
    };

    const fallbackPrimary: StateAction | undefined =
        // The paywall has one action and it is not a retry. `go-pro` sells nothing today and
        // says so, which is still the right destination: it is where the decision lives.
        state.key === 'locked'
            ? { label: 'Subscribe to Plus', icon: 'sparkles-outline', onPress: () => router.push('/resources/go-pro') }
            : state.retryable && onRetry
              ? retry
              : state.key === 'not_found' || state.key === 'not_allowed' || state.key === 'update'
                ? { label: 'Back to Dashboard', icon: 'home-outline', onPress: () => router.replace('/(tabs)') }
                : onRetry
                  ? retry
                  : undefined;

    const fallbackSecondary: StateAction =
        state.key === 'locked'
            ? { label: 'Maybe Later', icon: 'close-outline', onPress: () => router.back() }
            : { label: 'Contact Support', icon: 'chatbubble-ellipses-outline', onPress: () => router.push('/help') };

    return (
        <StateView
            state={state}
            variant={variant}
            primary={primary ?? fallbackPrimary}
            secondary={secondary === null ? undefined : (secondary ?? fallbackSecondary)}
            style={style}
        />
    );
};

/**
 * The compact form, for a screen whose refresh failed but which still has content.
 *
 * **A state screen replaces content only when there is no content.** A hub already showing
 * yesterday's library, a catalogue already showing yesterday's products — replacing those
 * with an illustration because a background refresh missed loses information in order to
 * report the loss of information, and leaves somebody worse off than if the refresh had
 * never run. The same call `ConnectionBanner` makes for the whole app.
 *
 * It does not name a cause. The cause is already on screen — either the connection banner
 * at the top, or nothing, in which case it was transient and naming a status code would be
 * the server's wording in the middle of somebody's shopping.
 */
export const StaleNotice = ({ onRetry }: { onRetry: () => void }) => (
    <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="This did not refresh. Tap to try again."
        style={({ pressed }) => [staleStyles.row, pressed && { opacity: 0.7 }]}
    >
        <Ionicons name="refresh-outline" size={14} color={Palette.textSecondary} />
        <Text style={staleStyles.label}>Showing what we had — tap to refresh</Text>
    </Pressable>
);

const staleStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        backgroundColor: Palette.surface,
        alignSelf: 'center',
    },
    label: { fontSize: 12, ...BodyFont.medium, color: Palette.textSecondary },
});

type EmptyStateProps = {
    /** Which drawing. `empty` unless the emptiness has a cause worth naming. */
    kind?: Extract<StateKey, 'empty' | 'locked' | 'update'>;
    title?: string;
    body?: string;
    badge?: string | null;
    /** The one thing there is to do about it — start the tracker, log the first entry. */
    action?: StateAction;
    variant?: 'screen' | 'inline';
    style?: ViewStyle;
};

export const EmptyState = ({
    kind = 'empty',
    title,
    body,
    badge,
    action,
    variant = 'inline',
    style,
}: EmptyStateProps) => (
    <StateView
        state={describeState(kind, {
            ...(title === undefined ? {} : { title }),
            ...(body === undefined ? {} : { body }),
            ...(badge === undefined ? {} : { badge }),
        })}
        variant={variant}
        primary={action}
        style={style}
    />
);
