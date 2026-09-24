/**
 * The Unread / Read switch — `Design/notification.svg` frames 0 and 1.
 *
 * The kit draws a pale track with a raised white pill over the selected half. It is drawn
 * here rather than configured for the same reason `AppTabBar` is: the interesting part is
 * the *thumb*, and a thumb that animates between positions cannot be expressed as two
 * buttons that restyle themselves.
 *
 * Three things are load-bearing:
 *
 * 1. **The thumb is one view that slides, not two that swap colour.** Swapping produces a
 *    switch that reads as two buttons; sliding produces one control with a position, which
 *    is what a segmented control is. It also means the label crossfade and the slide share
 *    a driver, so they cannot fall out of step.
 *
 * 2. **The track is measured, never assumed.** `onLayout` gives the real width and the
 *    thumb is half of it. Hard-coding from the screen width breaks on a tablet, in split
 *    screen, and at every text size that changes the gutter — and it breaks by putting the
 *    thumb over the wrong label, which reads as the wrong tab being selected.
 *
 * 3. **The count is on the tab, and it is the honest one.** `counts` comes off the feed and
 *    ignores the category filter, so "Read 12" does not become "Read 0" because somebody
 *    filtered to medications. A filtered count on an unfiltered tab is the bug this
 *    component's props shape exists to prevent — it never sees the filter.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Spacing, Radius, Fonts, Shadow, BodyFont } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';

export type TabKey = 'unread' | 'read';

interface Props {
    value: TabKey;
    onChange: (key: TabKey) => void;
    counts: { unread: number; read: number };
}

const TABS: { key: TabKey; label: string }[] = [
    { key: 'unread', label: 'Unread' },
    { key: 'read', label: 'Read' },
];

export default function SegmentedTabs({ value, onChange, counts }: Props) {
    const styles = useStyles();
    const [trackWidth, setTrackWidth] = useState(0);
    const slide = useRef(new Animated.Value(value === 'read' ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(slide, {
            toValue: value === 'read' ? 1 : 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [slide, value]);

    // Padding is 4 either side, so the thumb is half the inner width.
    const inner = Math.max(0, trackWidth - 8);
    const thumbWidth = inner / 2;

    return (
        <View
            style={styles.track}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            accessibilityRole="tablist"
        >
            {trackWidth > 0 && (
                <Animated.View
                    // Decoration: the labels carry the state for a screen reader.
                    pointerEvents="none"
                    accessibilityElementsHidden
                    style={[
                        styles.thumb,
                        {
                            width: thumbWidth,
                            transform: [{
                                translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, thumbWidth] }),
                            }],
                        },
                    ]}
                />
            )}

            {TABS.map((tab) => {
                const active = tab.key === value;
                const count = tab.key === 'unread' ? counts.unread : counts.read;
                return (
                    <Pressable
                        key={tab.key}
                        style={styles.tab}
                        onPress={() => onChange(tab.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${tab.label}, ${count}`}
                    >
                        <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
                        {count > 0 && (
                            <View style={[styles.pill, active && styles.pillActive]}>
                                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                    {count > 99 ? '99+' : count}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    track: {
        flexDirection: 'row',
        marginHorizontal: 16,
        padding: 4,
        borderRadius: Radius.md,
        backgroundColor: Palette.borderLight,
    },
    thumb: {
        position: 'absolute',
        top: 4, bottom: 4, left: 4,
        borderRadius: Radius.sm,
        backgroundColor: Palette.background,
        ...Shadow.card,
    },
    tab: {
        flex: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: Spacing.md,
    },
    label: { fontSize: 15, color: Palette.textSecondary, ...BodyFont.medium },
    labelActive: { color: Palette.text, fontFamily: Fonts.bold },
    pill: {
        minWidth: 20, paddingHorizontal: 5, paddingVertical: 1,
        borderRadius: Radius.pill, backgroundColor: Palette.border,
        alignItems: 'center',
    },
    pillActive: { backgroundColor: Palette.primaryFill },
    pillText: { fontSize: 11, color: Palette.textSecondary, fontFamily: Fonts.bold },
    pillTextActive: { color: Palette.white },
}));
