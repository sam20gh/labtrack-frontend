/**
 * What would move your Miovix Age.
 *
 * The hub shows three; this shows everything the server offered, grouped by what kind of
 * acting each one would take.
 *
 * **The grouping is the point, not the ranking.** A list ordered purely by years puts "ask
 * about your RDW" above "walk more" and reads as a to-do list with an impossible item at the
 * top. Behaviour and clinic are different kinds of thing: one is a habit somebody can change
 * this week, the other is a question for whoever knows their history. Separating them is what
 * stops the screen handing people homework they cannot complete — the same line the symptom
 * checker holds when it refuses to name a condition.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getAgeLevers, deltaLabel, type AgeLever, type AgeLevers } from '@/lib/age';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';

export default function AgeLeversScreen() {
    const router = useRouter();
    const [data, setData] = useState<AgeLevers | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const mounted = useRef(true);

    const load = useCallback(async () => {
        try {
            const res = await getAgeLevers();
            if (mounted.current) setData(res);
        } catch {
            if (mounted.current) setData({ ok: false, levers: [], message: 'Could not load this just now.' });
        } finally {
            if (mounted.current) { setLoading(false); setRefreshing(false); }
        }
    }, []);

    useFocusEffect(useCallback(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; };
    }, [load]));

    const behaviour = (data?.levers ?? []).filter((l) => l.modifiable === 'behaviour');
    const clinical = (data?.levers ?? []).filter((l) => l.modifiable === 'clinical');

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>What would move it</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.centre}><ActivityIndicator color={Palette.primary} /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.body}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); load(); }}
                            tintColor={Palette.primary}
                        />
                    }
                >
                    {data?.ok && (
                        <Text style={styles.lede}>
                            Your Miovix Age is {data.value?.toFixed(1)} — {deltaLabel(data.delta)}. Each
                            figure below is what that one change alone would be worth.
                        </Text>
                    )}

                    {!data?.ok && (
                        <View style={styles.empty}>
                            <Ionicons name="hourglass-outline" size={28} color={Palette.textMuted} />
                            <Text style={styles.emptyTitle}>Nothing to suggest yet</Text>
                            <Text style={styles.emptyBody}>{data?.message}</Text>
                        </View>
                    )}

                    {behaviour.length > 0 && (
                        <Group
                            title="Things you can change"
                            note="Each is compared with the guideline, not with what most people do."
                        >
                            {behaviour.map((l) => (
                                <Row key={l.key} lever={l} onPress={() => router.push(l.route as never)} />
                            ))}
                        </Group>
                    )}

                    {clinical.length > 0 && (
                        <Group
                            title="Things worth asking about"
                            note="These are results, not habits. Nothing in this app changes them — they are
                                  worth raising with a clinician who knows your history."
                        >
                            {clinical.map((l) => (
                                <Row key={l.key} lever={l} onPress={() => router.push(l.route as never)} />
                            ))}
                        </Group>
                    )}

                    {/*
                      The figures are individually true and do not add up, and the screen has to
                      say so. Each is computed with everything else held where it actually is, and
                      the conversion from risk to years is not linear — so two changes each worth
                      three years are not jointly worth six. A page that let somebody total the
                      column would be promising arithmetic the model does not support.
                    */}
                    {(behaviour.length > 0 || clinical.length > 0) && (
                        <Text style={styles.footnote}>
                            These do not add up. Each figure assumes everything else stays where it is,
                            so making two changes is worth less than the two numbers together.
                        </Text>
                    )}

                    {!!data?.disclaimer && <Text style={styles.disclaimer}>{data.disclaimer}</Text>}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const Group = ({ title, note, children }: { title: string; note: string; children: React.ReactNode }) => (
    <View style={styles.group}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupNote}>{note.replace(/\s+/g, ' ')}</Text>
        {children}
    </View>
);

const Row = ({ lever, onPress }: { lever: AgeLever; onPress: () => void }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
        <View style={styles.saving}>
            <Text style={styles.years}>−{lever.years.toFixed(1)}</Text>
            <Text style={styles.unit}>yrs</Text>
        </View>
        <View style={styles.rowBody}>
            <Text style={styles.label}>{lever.label}</Text>
            <Text style={styles.detail}>
                Now {lever.display ?? lever.value}{lever.unit ? ` ${lever.unit}` : ''} · aim for {lever.target}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.canvas },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    headerTitle: { fontFamily: Fonts.bold, fontSize: 17, color: Palette.text },
    body: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
    lede: { fontFamily: Fonts.regular, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },

    group: { marginBottom: Spacing.xl },
    groupTitle: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.text },
    groupNote: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textMuted, lineHeight: 17, marginTop: 2, marginBottom: Spacing.md },

    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        backgroundColor: Palette.background, borderRadius: Radius.xl,
        padding: Spacing.lg, borderWidth: 1, borderColor: Palette.border, marginBottom: Spacing.sm,
    },
    saving: { alignItems: 'center', minWidth: 46 },
    years: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.teal },
    unit: { fontFamily: Fonts.regular, fontSize: 10, color: Palette.textMuted },
    rowBody: { flex: 1 },
    label: { fontFamily: Fonts.semibold, fontSize: 14, color: Palette.text },
    detail: { fontFamily: Fonts.regular, fontSize: 12, color: Palette.textSecondary, marginTop: 1 },

    empty: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.sm },
    emptyTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    emptyBody: { fontFamily: Fonts.regular, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 },

    footnote: { fontFamily: Fonts.regular, fontSize: 11.5, color: Palette.textMuted, lineHeight: 17 },
    disclaimer: { fontFamily: Fonts.regular, fontSize: 11, color: Palette.textMuted, lineHeight: 17, marginTop: Spacing.lg },
});
