/**
 * Live-session settings. Per device (`lib/run/settings.ts`); each one changes something a
 * person will notice on their next run, and none of them changes what is recorded.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { setRunSetting, useRunSettings, type AudioCues } from '@/lib/run/settings';
import { useUnits } from '@/lib/units';

export default function RunSettingsScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const s = useRunSettings();
    const unit = useUnits().distance === 'mi' ? 'mile' : 'kilometre';

    const cues: { value: AudioCues; label: string }[] = [
        { value: 'unit', label: `Every ${unit}` },
        { value: 'half', label: `Every half ${unit}` },
        { value: 'off', label: 'Off' },
    ];

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.bar}>
                <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <Text style={styles.barTitle}>Activity settings</Text>
                <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.section}>Spoken splits</Text>
                <View style={styles.card}>
                    {cues.map((c, i) => (
                        <Pressable
                            key={c.value}
                            onPress={() => setRunSetting('audioCues', c.value)}
                            style={[styles.row, i > 0 && styles.divider]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: s.audioCues === c.value }}
                        >
                            <Text style={styles.rowLabel}>{c.label}</Text>
                            {s.audioCues === c.value && <Ionicons name="checkmark" size={20} color={Palette.primary} />}
                        </Pressable>
                    ))}
                </View>
                <Text style={styles.foot}>
                    Your distance and pace, read out as each one lands. On iPhone, cues may be silent while the screen is locked until the next app update.
                </Text>

                <Text style={styles.section}>Screen</Text>
                <View style={styles.card}>
                    <Toggle label="3·2·1 countdown" value={s.countdown} onChange={(v) => setRunSetting('countdown', v)} />
                    <Toggle label="High contrast" note="Black on white with a daylight map, for reading in full sun." value={s.highContrast} onChange={(v) => setRunSetting('highContrast', v)} divider />
                    <Toggle label="Keep screen on in Focus" note="Uses more battery. Recording never needs the screen on." value={s.keepAwakeOnFocus} onChange={(v) => setRunSetting('keepAwakeOnFocus', v)} divider />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function Toggle({ label, note, value, onChange, divider }: { label: string; note?: string; value: boolean; onChange: (v: boolean) => void; divider?: boolean }) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={[styles.row, divider && styles.divider]}>
            <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowLabel}>{label}</Text>
                {note && <Text style={styles.note}>{note}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ true: Palette.primaryFill, false: Palette.border }}
                accessibilityLabel={label}
            />
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
    barTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    content: { padding: Spacing.xl, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
    section: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.text, marginTop: Spacing.lg },
    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, minHeight: 52 },
    divider: { borderTopWidth: 1, borderTopColor: Palette.borderLight },
    rowLabel: { ...BodyFont.medium, fontSize: 15, color: Palette.text },
    note: { ...BodyFont.regular, fontSize: 13, lineHeight: 18, color: Palette.textSecondary },
    foot: { ...BodyFont.regular, fontSize: 13, lineHeight: 18, color: Palette.textSecondary, paddingHorizontal: Spacing.xs },
}));
