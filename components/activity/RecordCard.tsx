/**
 * "Record a workout" — the live GPS tracker's own card, with one button per type it tracks.
 *
 * The tracker used to be reachable only through the middle of three round shortcuts under the
 * chart, labelled after whatever the person logged most ("Start Walk"), or "Record Route" when
 * that was a swim. Someone who had never used it had no way to learn that the app would follow
 * a run, a walk or a ride live, and the two loudest controls on the page — the filled disc and
 * the floating button — both opened the manual form. This card says what the feature is and
 * puts every type it supports one tap from the dashboard.
 *
 * It is a hero surface, so it reads `Palettes.light` whatever the scheme (Dark mode rule 3):
 * the stage the launch pad opens onto is the same violet, and the card is its doorway.
 *
 * The order is fixed rather than sorted by use. A row that reshuffles itself after one
 * weekend of cycling is a row whose buttons have to be read again every time.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BodyFont, Fonts, Palettes, Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';
import { typeStyle } from '@/lib/activityTypes';
import { TYPE_LABEL } from '@/lib/run/format';
import type { TrackableType } from '@/lib/run/trackMath';

/** Run first: it is what people most often mean by "track a workout". */
export const RECORD_ORDER: TrackableType[] = ['jogging', 'walking', 'biking', 'hiking'];

interface Props {
    onStart: (type: TrackableType) => void;
}

export function RecordCard({ onStart }: Props) {
    const styles = useStyles();
    const hero = Palettes.light;

    return (
        <LinearGradient
            colors={hero.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
        >
            <View style={styles.head}>
                <View style={styles.badge}>
                    <Ionicons name="navigate" size={18} color={hero.white} />
                </View>
                <View style={styles.headText}>
                    <Text style={styles.title} accessibilityRole="header">Record a workout</Text>
                    <Text style={styles.body}>
                        Track your route, pace, distance and calories live with GPS.
                    </Text>
                </View>
            </View>

            <View style={styles.row}>
                {RECORD_ORDER.map((type) => (
                    <Pressable
                        key={type}
                        onPress={() => onStart(type)}
                        style={({ pressed }) => [styles.type, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`Start a ${TYPE_LABEL[type].toLowerCase()}`}
                    >
                        <MaterialCommunityIcons name={typeStyle(type).icon} size={24} color={hero.white} />
                        <Text style={styles.typeLabel}>{TYPE_LABEL[type]}</Text>
                    </Pressable>
                ))}
            </View>
        </LinearGradient>
    );
}

const useStyles = makeStyles(() => {
    const hero = Palettes.light;
    return {
        card: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.lg },
        head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
        badge: {
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.16)',
            alignItems: 'center', justifyContent: 'center',
        },
        headText: { flex: 1, gap: 2 },
        title: { fontSize: 17, fontFamily: Fonts.bold, color: hero.white },
        body: { fontSize: 13, lineHeight: 18, ...BodyFont.regular, color: 'rgba(255,255,255,0.82)' },
        row: { flexDirection: 'row', gap: Spacing.sm },
        type: {
            flex: 1,
            alignItems: 'center',
            gap: 6,
            paddingVertical: Spacing.md,
            borderRadius: Radius.lg,
            backgroundColor: 'rgba(255,255,255,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
        },
        typeLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: hero.white },
        pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
    };
});
