/**
 * The 1d / 1w / 1m / 1y / All selector.
 *
 * Shared rather than written three times: the activity, sleep and heart dashboards are the
 * same screen with different units, and three copies of a segmented control is how they
 * start drifting apart a pixel at a time.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Palette, Fonts } from '@/constants/theme';

export type MetricRange = '1d' | '1w' | '1m' | '1y' | 'all';

const LABELS: Record<MetricRange, string> = {
    '1d': '1d',
    '1w': '1w',
    '1m': '1m',
    '1y': '1y',
    all: 'All',
};

const ORDER: MetricRange[] = ['1d', '1w', '1m', '1y', 'all'];

interface Props {
    value: MetricRange;
    onChange: (range: MetricRange) => void;
}

export function RangeTabs({ value, onChange }: Props) {
    return (
        <View style={styles.track}>
            {ORDER.map((range) => {
                const active = range === value;
                return (
                    <Pressable
                        key={range}
                        onPress={() => onChange(range)}
                        style={[styles.tab, active && styles.tabActive]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Show ${LABELS[range]}`}
                    >
                        <Text style={[styles.label, active && styles.labelActive]}>
                            {LABELS[range]}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        backgroundColor: Palette.borderLight,
        borderRadius: 12,
        padding: 4,
        gap: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 9,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: Palette.white,
        // The kit lifts the selected segment rather than colouring it, so the control reads
        // as a physical switch instead of five buttons one of which is highlighted.
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    label: {
        fontSize: 13,
        fontFamily: Fonts.medium,
        color: Palette.textSecondary,
    },
    labelActive: {
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
});
