/**
 * Appearance — Light, Dark, or match the phone.
 *
 * Three rows, one checked, and the choice applies the moment it is tapped: the screen
 * recolours underneath the finger, which is the only preview that cannot lie about what
 * the rest of the app will look like. No save button — a preference that has to be
 * confirmed is a preference somebody forgets to confirm.
 *
 * "Match phone" is first and the default because it is the only one that is right at both
 * 2pm and 11pm without being touched again.
 */
import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import {
    APPEARANCE_OPTIONS, setAppearance, useAppearancePreference, type AppearancePreference,
} from '@/lib/appearance';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette, useTheme } from '@/hooks/useTheme';

export default function AppearanceScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const { scheme } = useTheme();
    const preference = useAppearancePreference();

    const choose = useCallback((value: AppearancePreference) => {
        Haptics.selectionAsync().catch(() => { });
        setAppearance(value);
    }, []);

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <ScreenHeader title="Appearance" subtitle="Choose light, dark, or match your phone" />

                <View style={styles.body}>
                    <View style={styles.group} accessibilityRole="radiogroup">
                        {APPEARANCE_OPTIONS.map((option, i) => {
                            const selected = option.value === preference;
                            return (
                                <Pressable
                                    key={option.value}
                                    onPress={() => choose(option.value)}
                                    style={({ pressed }) => [
                                        styles.row,
                                        i < APPEARANCE_OPTIONS.length - 1 && styles.rowDivider,
                                        pressed && styles.rowPressed,
                                    ]}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    accessibilityLabel={option.label}
                                    accessibilityHint={option.hint}
                                >
                                    <View style={[styles.icon, selected && styles.iconOn]}>
                                        <Ionicons
                                            name={option.icon as never}
                                            size={18}
                                            color={selected ? Palette.primary : Palette.textSecondary}
                                        />
                                    </View>
                                    <View style={styles.rowBody}>
                                        <Text style={styles.label}>{option.label}</Text>
                                        <Text style={styles.hint}>{option.hint}</Text>
                                    </View>
                                    <Ionicons
                                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={22}
                                        color={selected ? Palette.primary : Palette.borderStrong}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>

                    {preference === 'system' && (
                        <Text style={styles.now}>
                            Your phone is set to {scheme === 'dark' ? 'dark' : 'light'} right now.
                        </Text>
                    )}

                    <Text style={styles.footer}>
                        This setting applies to this device only.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    scroll: { paddingBottom: 48 },
    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.lg },

    group: {
        backgroundColor: Palette.background,
        borderRadius: Radius.xl,
        borderWidth: 1,
        borderColor: Palette.border,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2,
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: Palette.borderLight },
    rowPressed: { backgroundColor: Palette.surface },
    icon: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.borderLight,
    },
    iconOn: { backgroundColor: Palette.primarySurface },
    rowBody: { flex: 1 },
    label: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    hint: { fontSize: 12.5, ...BodyFont.regular, color: Palette.textSecondary, marginTop: 2 },

    now: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, paddingHorizontal: Spacing.xs },
    footer: {
        fontSize: 12, lineHeight: 18, ...BodyFont.regular, color: Palette.textMuted,
        paddingHorizontal: Spacing.xs,
    },
}));
