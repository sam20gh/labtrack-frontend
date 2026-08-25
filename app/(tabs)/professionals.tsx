/**
 * Find a specialist.
 *
 * Rebuilt onto the turing kit tokens the rest of the app moved to — this screen still had
 * bootstrap blue (`#007bff`), a `#0000ff` spinner and a grey card list, and it is the screen
 * a plan's "Consult a Cardiologist" sends people to.
 *
 * The filter chips are derived from the specialities actually present in the roster rather
 * than the 48-value enum: offering a filter that returns nothing is worse than not offering
 * it, and the list is short enough today that a static taxonomy would be mostly dead ends.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, FlatList, Image, StyleSheet, ActivityIndicator,
    TouchableOpacity, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import { Palette, Spacing, Radius, Shadow, Fonts } from '@/constants/theme';
import type { Professional } from '@/types/api';

// expo-router screens are not in a typed param list, so navigate() infers `never`
type AppNavigation = NavigationProp<Record<string, object | undefined>>;

const ALL = '__all__';

const initialsOf = (p: Professional) =>
    `${p.firstname?.[0] ?? ''}${p.lastname?.[0] ?? ''}`.toUpperCase() || '?';

const ProfessionalsScreen = () => {
    const navigation = useNavigation<AppNavigation>();

    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [speciality, setSpeciality] = useState<string>(ALL);

    const fetchProfessionals = useCallback(async () => {
        try {
            const data = await api.get<Professional[]>('/professionals');
            setProfessionals(Array.isArray(data) ? data : []);
        } catch (error) {
            // The old version logged to the console and showed an endless spinner.
            const message = error instanceof ApiError ? error.message : 'Could not load specialists';
            Toast.show({ type: 'error', text1: 'Could not load specialists', text2: message });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Refetch when the tab regains focus; pull-to-refresh covers manual updates
    useFocusEffect(useCallback(() => { fetchProfessionals(); }, [fetchProfessionals]));

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchProfessionals();
    }, [fetchProfessionals]);

    /** Specialities present in the roster, commonest first, with their counts. */
    const specialities = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of professionals) {
            for (const s of p.speciality ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([name, count]) => ({ name, count }));
    }, [professionals]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return professionals.filter((p) => {
            if (speciality !== ALL && !(p.speciality ?? []).includes(speciality)) return false;
            if (!q) return true;
            // Name or speciality — someone types either "Patel" or "cardiology"
            const haystack = `${p.firstname} ${p.lastname} ${(p.speciality ?? []).join(' ')}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [professionals, query, speciality]);

    const filtered = query.trim().length > 0 || speciality !== ALL;

    const clearFilters = () => { setQuery(''); setSpeciality(ALL); };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    // Passed as an element rather than a function: an inline arrow would be a new component
    // type on every keystroke, remounting the search field and dropping the keyboard.
    const header = (
        <View style={styles.header}>
            <Text style={styles.pageTitle}>Find a specialist</Text>
            <Text style={styles.pageSubtitle}>
                {professionals.length === 0
                    ? 'No specialists listed yet'
                    : `${professionals.length} available${filtered ? ` · ${results.length} matching` : ''}`}
            </Text>

            <View style={styles.searchRow}>
                <Ionicons name="search" size={17} color={Palette.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by name or speciality"
                    placeholderTextColor={Palette.textMuted}
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
            </View>

            {specialities.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                    keyboardShouldPersistTaps="handled"
                >
                    <Chip
                        label="All"
                        count={professionals.length}
                        active={speciality === ALL}
                        onPress={() => setSpeciality(ALL)}
                    />
                    {specialities.map((s) => (
                        <Chip
                            key={s.name}
                            label={s.name}
                            count={s.count}
                            active={speciality === s.name}
                            onPress={() => setSpeciality(speciality === s.name ? ALL : s.name)}
                        />
                    ))}
                </ScrollView>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={results}
                keyExtractor={(item) => item._id}
                ListHeaderComponent={header}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons
                            name={filtered ? 'search-outline' : 'people-outline'}
                            size={38}
                            color={Palette.primaryLight}
                        />
                        <Text style={styles.emptyTitle}>
                            {filtered ? 'No specialists match' : 'No specialists yet'}
                        </Text>
                        <Text style={styles.emptyBody}>
                            {filtered
                                ? 'Try a different speciality, or clear the filters to see everyone.'
                                : 'Specialists appear here once they join LabTrack.'}
                        </Text>
                        {filtered && (
                            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                                <Text style={styles.clearButtonText}>Clear filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                renderItem={({ item }) => (
                    <ProfessionalCard
                        professional={item}
                        onPress={() => navigation.navigate('professionalDetails', { professional: item })}
                    />
                )}
            />
        </SafeAreaView>
    );
};

const Chip = ({ label, count, active, onPress }: {
    label: string; count: number; active: boolean; onPress: () => void;
}) => (
    <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
    >
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
    </TouchableOpacity>
);

const ProfessionalCard = ({ professional, onPress }: {
    professional: Professional; onPress: () => void;
}) => {
    const specialities = professional.speciality ?? [];
    // Two chips plus an overflow count: a practitioner with six specialities would
    // otherwise push the rate off the card.
    const shown = specialities.slice(0, 2);
    const overflow = specialities.length - shown.length;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
            {professional.profile_image ? (
                <Image source={{ uri: professional.profile_image }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>{initialsOf(professional)}</Text>
                </View>
            )}

            <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={1}>
                    {professional.firstname} {professional.lastname}
                </Text>

                <View style={styles.tagRow}>
                    {shown.map((s) => (
                        <View key={s} style={styles.tag}>
                            <Text style={styles.tagText} numberOfLines={1}>{s}</Text>
                        </View>
                    ))}
                    {overflow > 0 && (
                        <View style={[styles.tag, styles.tagMuted]}>
                            <Text style={[styles.tagText, styles.tagTextMuted]}>+{overflow}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.metaRow}>
                    <Text style={styles.rate}>£{professional.hourly_rate}</Text>
                    <Text style={styles.rateUnit}>/hr</Text>
                    {!!professional.country && (
                        <>
                            <View style={styles.dot} />
                            <Text style={styles.country} numberOfLines={1}>{professional.country}</Text>
                        </>
                    )}
                </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
        </TouchableOpacity>
    );
};

const GUTTER = Spacing.lg;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    list: { paddingBottom: Spacing.xxxl },

    header: { paddingHorizontal: GUTTER, paddingTop: Spacing.lg, gap: Spacing.md },
    pageTitle: { fontSize: 24, color: Palette.text, fontFamily: Fonts.bold },
    pageSubtitle: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular, marginTop: -6,
    },

    searchRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Palette.surface, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Palette.border,
        paddingHorizontal: Spacing.md, height: 44,
    },
    searchInput: {
        flex: 1, fontSize: 14, color: Palette.text, fontFamily: Fonts.regular, padding: 0,
    },

    chipRow: { gap: Spacing.sm, paddingBottom: Spacing.xs, paddingRight: GUTTER },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: 7,
        borderRadius: Radius.pill, backgroundColor: Palette.surface,
        borderWidth: 1, borderColor: Palette.border,
    },
    chipActive: { backgroundColor: Palette.primary, borderColor: Palette.primary },
    chipText: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.semibold },
    chipTextActive: { color: Palette.white },
    chipCount: { fontSize: 11, color: Palette.textMuted, fontFamily: Fonts.semibold },
    chipCountActive: { color: 'rgba(255,255,255,0.8)' },

    card: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        marginHorizontal: GUTTER, marginTop: Spacing.md,
        padding: Spacing.lg, borderRadius: Radius.lg,
        backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
        ...Shadow.card,
    },
    avatar: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.surface },
    avatarFallback: {
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.primarySurface,
    },
    avatarText: { fontSize: 16, color: Palette.primary, fontFamily: Fonts.bold },
    cardBody: { flex: 1, gap: 5 },
    name: { fontSize: 15, color: Palette.text, fontFamily: Fonts.semibold },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    tag: {
        paddingHorizontal: Spacing.sm, paddingVertical: 2,
        borderRadius: Radius.sm, backgroundColor: Palette.primarySurface, maxWidth: 150,
    },
    tagMuted: { backgroundColor: Palette.borderLight },
    tagText: { fontSize: 11, color: Palette.primary, fontFamily: Fonts.semibold },
    tagTextMuted: { color: Palette.textSecondary },

    metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 1 },
    rate: { fontSize: 15, color: Palette.text, fontFamily: Fonts.bold },
    rateUnit: { fontSize: 12, color: Palette.textMuted, fontFamily: Fonts.regular },
    dot: {
        width: 3, height: 3, borderRadius: Radius.pill,
        backgroundColor: Palette.textMuted, marginHorizontal: Spacing.xs, alignSelf: 'center',
    },
    country: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular },

    empty: {
        alignItems: 'center', gap: Spacing.sm,
        marginHorizontal: GUTTER, marginTop: Spacing.xxl,
        padding: Spacing.xxl, borderRadius: Radius.lg, backgroundColor: Palette.surface,
    },
    emptyTitle: { fontSize: 16, color: Palette.text, fontFamily: Fonts.bold },
    emptyBody: {
        fontSize: 13, lineHeight: 19, color: Palette.textSecondary,
        textAlign: 'center', fontFamily: Fonts.regular,
    },
    clearButton: {
        marginTop: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.xl,
        borderRadius: Radius.md, backgroundColor: Palette.primary,
    },
    clearButtonText: { color: Palette.white, fontSize: 14, fontFamily: Fonts.semibold },
});

export default ProfessionalsScreen;
