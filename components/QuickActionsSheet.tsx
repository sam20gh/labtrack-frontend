/**
 * The popover behind the tab bar's centre button.
 *
 * A popover anchored to the button rather than a bottom sheet, because the button is what it
 * belongs to: the caret points at the thing that opened it, so there is never a question of
 * what dismisses it or where it came from. A sheet sliding over the bar would cover the
 * button and read as a separate destination.
 *
 * It draws the shortcuts from `lib/quickActions.ts` — the single definition of that list, so
 * a second surface cannot drift from it the first time a tracker is added.
 *
 * Dismissal: the backdrop, the hardware back button, and picking an action. There is no
 * close control in the card — the caret and the dimmed page behind already say this is a
 * layer over the app rather than a screen, and a grid with one more cell for "close" is a
 * cell that does nothing but undo opening it.
 */
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
    View, Text, StyleSheet, Modal, Pressable, Animated, Easing, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { QUICK_ACTIONS, type QuickAction } from '@/lib/quickActions';
import { Spacing, Radius, BodyFont, tone } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import * as recorder from '@/lib/run/recorder';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (action: QuickAction) => void;
    /** The live GPS tracker — or, while one is recording (`true`), the way back to it. */
    onRecord: (recording: boolean) => void;
    /** Height of the bar the caret has to sit above, so the two never overlap. */
    barHeight: number;
}

export function QuickActionsSheet({ visible, onClose, onSelect, onRecord, barHeight }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    const anim = useRef(new Animated.Value(0)).current;
    useSyncExternalStore(recorder.subscribe, recorder.getVersion);
    const { phase } = recorder.getState();
    const recording = phase === 'recording' || phase === 'paused';

    useEffect(() => {
        Animated.timing(anim, {
            toValue: visible ? 1 : 0,
            duration: visible ? 180 : 120,
            easing: visible ? Easing.out(Easing.back(1.3)) : Easing.in(Easing.ease),
            useNativeDriver: true,
        }).start();
    }, [visible, anim]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close shortcuts" />

            {/*
              `pointerEvents="box-none"` so the area either side of the card still reaches the
              backdrop underneath. Without it the whole bottom of the screen becomes an
              invisible dead zone that swallows the tap meant to dismiss.
            */}
            <View
                pointerEvents="box-none"
                style={[styles.anchor, { paddingBottom: barHeight + insets.bottom + Spacing.sm }]}
            >
                <Animated.View
                    style={[
                        styles.popover,
                        {
                            opacity: anim,
                            // Grows out of the button rather than fading in place
                            transform: [
                                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                            ],
                        },
                    ]}
                >
                    {/*
                      Recording a workout is the one thing here that *starts* something rather
                      than opening a screen, and it is the thing somebody reaches for with their
                      shoes already on — so it is a full-width row above the grid, not a sixteenth
                      tile. A tile would also leave one orphan on a final row (see
                      `lib/quickActions.ts`); a row is a different element and does not count.
                      While a recording is going it becomes the way back to it.
                    */}
                    <TouchableOpacity
                        style={styles.record}
                        onPress={() => onRecord(recording)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={recording ? 'Back to your workout' : 'Record a workout with GPS'}
                    >
                        <View style={styles.recordIcon}>
                            <Ionicons name={recording ? 'radio-button-on' : 'play'} size={18} color={Palette.white} />
                        </View>
                        <View style={styles.recordText}>
                            <Text style={styles.recordTitle}>{recording ? 'Back to your workout' : 'Record a workout'}</Text>
                            <Text style={styles.recordBody} numberOfLines={1}>
                                {recording ? 'Recording in progress' : 'Run, walk, ride or hike with GPS'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Palette.primary} />
                    </TouchableOpacity>

                    <View style={styles.grid}>
                        {QUICK_ACTIONS.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={styles.action}
                                onPress={() => onSelect(action)}
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={action.label}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: action.surface }]}>
                                    <Ionicons name={action.icon} size={22} color={action.tint} />
                                </View>
                                <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/*
                      The caret. Two stacked triangles rather than a rotated square: a rotated
                      square carries the card's border on two of its edges and shows them as a
                      seam across the tip. The lower one is the fill, inset by the border width.
                    */}
                    <View style={styles.caretWrap} pointerEvents="none">
                        <View style={styles.caretBorder} />
                        <View style={styles.caretFill} />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

/** Half the caret's width. Kept here so the two triangles cannot drift apart. */
const CARET = 11;

const useStyles = makeStyles((Palette) => ({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
    anchor: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.lg },

    popover: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl * 1.6,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.sm,
        shadowColor: tone('#0F172A'),
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 12,
    },

    record: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: Spacing.md, marginBottom: Spacing.xl,
        padding: Spacing.md, borderRadius: Radius.lg,
        backgroundColor: Palette.primaryTint, borderWidth: 1, borderColor: Palette.primaryPale,
    },
    recordIcon: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.primaryFill,
        alignItems: 'center', justifyContent: 'center',
    },
    recordText: { flex: 1, gap: 1 },
    recordTitle: { ...BodyFont.semibold, fontSize: 15, color: Palette.text },
    recordBody: { ...BodyFont.regular, fontSize: 12.5, color: Palette.textSecondary },

    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xl },
    // Fixed fraction, not `flex` — flex children do not wrap onto even columns, the same
    // note the home grid carries.
    action: { width: '33.333%', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xs },
    actionIcon: {
        width: 52, height: 52, borderRadius: 26,
        // Background comes from the action's own `surface`. No border: a pale tinted disc on
        // white already reads as a shape, and a grey ring around fifteen colours muddies them.
        alignItems: 'center', justifyContent: 'center',
    },
    actionLabel: { ...BodyFont.medium, fontSize: 12, color: Palette.text },

    caretWrap: { position: 'absolute', bottom: -CARET, left: 0, right: 0, alignItems: 'center' },
    caretBorder: {
        width: 0, height: 0, backgroundColor: 'transparent',
        borderLeftWidth: CARET, borderRightWidth: CARET, borderTopWidth: CARET,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: Palette.borderSlate,
    },
    caretFill: {
        position: 'absolute', top: 0,
        width: 0, height: 0, backgroundColor: 'transparent',
        borderLeftWidth: CARET, borderRightWidth: CARET, borderTopWidth: CARET,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: Palette.background,
    },
}));
