/**
 * The three pickers a day's log is made of — flow, symptoms, mood — shared by the dashboard's
 * "Today" card and the full log screen, so a flow chosen in one reads identically in the other.
 *
 * Every control can be cleared by tapping the selected option again. "None" is not a fifth
 * flow: a day with no bleeding is a day with no flow, and making somebody pick "None" to undo a
 * mis-tap is a control explaining an absence.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Spacing, Radius, BodyFont, Fonts } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { FLOWS, SYMPTOMS, MOODS, type Flow, type Symptom } from '@/lib/cycle';

/** Drops, drawn: none for spotting (a small dot), then one, two, three. */
function Drops({ count, color }: { count: number; color: string }) {
    if (count === 0) return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginVertical: 5 }} />;
    return (
        <View style={{ flexDirection: 'row', gap: 1 }}>
            {Array.from({ length: count }, (_, i) => <Ionicons key={i} name="water" size={16} color={color} />)}
        </View>
    );
}

export function FlowPicker({ value, onChange }: { value: Flow | null; onChange: (f: Flow | null) => void }) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.flowRow} accessibilityRole="radiogroup" accessibilityLabel="Flow">
            {FLOWS.map((f) => {
                // A day marked from a range has flow "unspecified": it is a period day, and
                // none of the four is selected until somebody says which.
                const on = value === f.key;
                return (
                    <Pressable
                        key={f.key}
                        style={[styles.flow, on && styles.flowOn]}
                        onPress={() => onChange(on ? null : f.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={f.label}
                    >
                        <Drops count={f.drops} color={on ? Palette.white : Palette.cycle} />
                        <Text style={[styles.flowLabel, on && styles.flowLabelOn]}>{f.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

export function SymptomChips({
    value, onChange, compact = false,
}: { value: Symptom[]; onChange: (s: Symptom[]) => void; compact?: boolean }) {
    const Palette = usePalette();
    const styles = useStyles();
    const list = compact ? SYMPTOMS.slice(0, 6) : SYMPTOMS;
    const toggle = (s: Symptom) => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
    return (
        <View style={styles.chips}>
            {list.map((s) => {
                const on = value.includes(s.key);
                return (
                    <Pressable
                        key={s.key}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => toggle(s.key)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={s.label}
                    >
                        <Ionicons name={s.icon} size={14} color={on ? Palette.primary : Palette.textSecondary} />
                        <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{s.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

export function MoodPicker({ value, onChange }: { value: number | null; onChange: (m: number | null) => void }) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.moodRow} accessibilityRole="radiogroup" accessibilityLabel="Mood">
            {MOODS.map((m) => {
                const on = value === m.value;
                return (
                    <Pressable
                        key={m.value}
                        style={styles.mood}
                        onPress={() => onChange(on ? null : m.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={m.label}
                    >
                        <View style={[styles.face, on && styles.faceOn]}>
                            <MaterialIcons name={m.icon} size={26} color={on ? Palette.primary : Palette.textMuted} />
                        </View>
                        <Text style={[styles.moodLabel, on && styles.moodLabelOn]}>{m.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    flowRow: { flexDirection: 'row', gap: Spacing.sm },
    flow: {
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: Spacing.md, borderRadius: Radius.lg,
        backgroundColor: Palette.cycleSurface, borderWidth: 1, borderColor: 'transparent', minHeight: 64,
    },
    flowOn: { backgroundColor: Palette.cycleFill },
    flowLabel: { fontSize: 12, ...BodyFont.medium, color: Palette.text },
    flowLabelOn: { color: Palette.white },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.background,
    },
    // Selected is state, and state is the brand violet — the same rule every chip follows.
    chipOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    chipLabel: { fontSize: 13, ...BodyFont.regular, color: Palette.text },
    chipLabelOn: { ...BodyFont.medium, color: Palette.primary },

    moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
    mood: { alignItems: 'center', gap: 4, flex: 1 },
    face: {
        width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'transparent',
    },
    faceOn: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    moodLabel: { fontSize: 11, ...BodyFont.regular, color: Palette.textSecondary },
    moodLabelOn: { fontFamily: Fonts.semibold, color: Palette.primary },
}));
