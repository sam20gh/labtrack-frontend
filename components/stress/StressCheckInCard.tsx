/**
 * "How do you feel right now?" — the person's own answer beside the bracelet's number.
 *
 * Five feelings rather than a slider, because a 1–10 scale asks somebody to calibrate a number
 * in their head. The server stores the bracelet's nearest reading with the answer, as it stood,
 * so the pair shown here is what they saw when they answered.
 *
 * It is a diary, not a measurement the app acts on: not read by the score, never an alert.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { BodyFont, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import {
    FEELINGS, deleteStressCheckIn, logStressCheckIn, type Feeling, type StressCheckIn,
} from '@/lib/stress';

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const StressCheckInCard = ({ feelings, today, onChanged }: {
    feelings?: Feeling[];
    /** Today's check-ins, newest first. */
    today: StressCheckIn[];
    onChanged: () => void;
}) => {
    const Palette = usePalette();
    const styles = useStyles();
    const [saving, setSaving] = useState<number | null>(null);
    const options = feelings?.length ? feelings : FEELINGS;

    const save = async (feeling: Feeling) => {
        setSaving(feeling.value);
        try {
            const { checkIn } = await logStressCheckIn(feeling.value);
            Toast.show({
                type: 'success',
                text1: `Saved — ${feeling.label.toLowerCase()}`,
                text2: checkIn.deviceScore != null ? `Your bracelet read ${checkIn.deviceScore} around then.` : undefined,
            });
            onChanged();
        } catch {
            Toast.show({ type: 'error', text1: 'Could not save your check-in' });
        } finally {
            setSaving(null);
        }
    };

    const remove = (c: StressCheckIn) => {
        Alert.alert('Remove this check-in?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try { await deleteStressCheckIn(c.id); onChanged(); } catch {
                        Toast.show({ type: 'error', text1: 'Could not remove that check-in' });
                    }
                },
            },
        ]);
    };

    return (
        <View style={styles.card}>
            <Text style={styles.title}>How do you feel right now?</Text>
            <Text style={styles.hint}>Kept beside your bracelet's reading, so you can see whether the two agree.</Text>

            <View style={styles.chips}>
                {options.map((f) => (
                    <TouchableOpacity
                        key={f.value}
                        style={styles.chip}
                        onPress={() => save(f)}
                        disabled={saving !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`I feel ${f.label.toLowerCase()}`}
                    >
                        {saving === f.value
                            ? <ActivityIndicator size="small" color={Palette.primary} />
                            : <Text style={styles.chipText}>{f.label}</Text>}
                    </TouchableOpacity>
                ))}
            </View>

            {today.length > 0 && (
                <View style={styles.list}>
                    {today.map((c) => (
                        <View key={c.id} style={styles.row}>
                            <Text style={styles.rowText}>
                                <Text style={styles.rowTime}>{time(c.at)}</Text>
                                {`  You felt ${c.feelingLabel?.toLowerCase() ?? '—'}`}
                                {c.deviceScore != null ? ` · bracelet ${c.deviceScore}` : ' · no bracelet reading nearby'}
                            </Text>
                            <TouchableOpacity onPress={() => remove(c)} hitSlop={10} accessibilityLabel="Remove this check-in">
                                <Ionicons name="close" size={16} color={Palette.textMuted} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

const useStyles = makeStyles((Palette) => ({
    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.card },
    title: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    hint: { ...BodyFont.regular, fontSize: 12, color: Palette.textMuted, lineHeight: 17 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    chip: {
        minWidth: 64, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primary,
    },
    chipText: { fontFamily: Fonts.semibold, fontSize: 12, color: Palette.primary },
    list: { borderTopWidth: 1, borderTopColor: Palette.borderLight, paddingTop: Spacing.xs, gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    rowText: { ...BodyFont.regular, fontSize: 12, color: Palette.textSecondary, flex: 1 },
    rowTime: { ...BodyFont.medium, color: Palette.text, fontVariant: ['tabular-nums'] },
}));
