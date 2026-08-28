/**
 * Check your symptoms — the kit's Symptom Checker entry screen.
 *
 * Follows `Design/symptons.svg` frame for frame: the centred question, the search field
 * with its add/remove suggestion list, the "My Symptoms" chips, the amber finding score
 * over its track, and the three-button bar — browse, analyse, refine.
 *
 * Three deliberate departures from the kit, each because of something the kit's flow does
 * not have to be true about:
 *
 * - **No 3D anatomy model.** The kit browses a rendered body in muscle and organ modes.
 *   Nothing in this app ships such a model, so the left button opens a body-area index
 *   instead (`BodyAreaSheet`). An illustration of a body that cannot be rotated or probed
 *   would promise an interaction that is not there.
 * - **The score is a completeness meter, not a confidence one.** The kit labels it
 *   "Symptom checker finding score" and says "More score means you'll get more accurate
 *   result", which reads as certainty about the answer. Here it measures only how much of
 *   what the assistant needs has been supplied, and the caption names the next thing to
 *   add. See `findingScore`.
 * - **The answer comes from the assistant that already exists.** The kit ends on a
 *   "Possible Conditions" list with match percentages. There is no engine behind such a
 *   list, and inventing one would be inventing a diagnosis. Instead the selections become
 *   one message to `/api/assistant`, which answers with the person's own biomarkers, plan
 *   and history in context — and under the precautions they accepted in `assistant/intro`,
 *   which is why this screen will not send until those have been accepted.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { api, ApiError } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { getConversation, sendMessage } from '@/lib/assistant';
import {
    searchSymptoms, symptomById, findingScore, nextStepFor, buildAssistantMessage,
    EMPTY_DRAFT, type Symptom, type SymptomDraft,
} from '@/lib/symptoms';
import BodyAreaSheet from '@/components/symptoms/BodyAreaSheet';
import DetailSheet from '@/components/symptoms/DetailSheet';
import { Palette, Spacing, Radius, Fonts, Shadow } from '@/constants/theme';
import type { User } from '@/types/api';

export default function SymptomsScreen() {
    const router = useRouter();
    const inputRef = useRef<TextInput>(null);

    const [firstName, setFirstName] = useState<string | null>(null);
    const [draft, setDraft] = useState<SymptomDraft>(EMPTY_DRAFT);
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const [browsing, setBrowsing] = useState(false);
    const [detailing, setDetailing] = useState(false);
    const [sending, setSending] = useState(false);

    // The name only personalises the title, so a failure here is not worth surfacing —
    // the question reads fine without it.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const userId = await getUserId();
                if (!userId) return;
                const user = await api.get<User>(`/users/${userId}`);
                if (!cancelled) setFirstName(user.firstName?.trim() || null);
            } catch {
                /* title falls back to the unpersonalised form */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const suggestions = useMemo(() => searchSymptoms(query), [query]);
    const chosen = useMemo(
        () => draft.symptomIds
            .map((id) => symptomById(id))
            .filter((s): s is Symptom => Boolean(s)),
        [draft.symptomIds],
    );
    const score = findingScore(draft);

    const toggle = useCallback((id: string) => {
        setDraft((prev) => ({
            ...prev,
            symptomIds: prev.symptomIds.includes(id)
                ? prev.symptomIds.filter((s) => s !== id)
                : [...prev.symptomIds, id],
        }));
    }, []);

    const analyse = useCallback(async () => {
        if (!draft.symptomIds.length || sending) return;
        setSending(true);
        try {
            // The precautions gate belongs to the assistant, not to this screen, so it is
            // read from the same place the assistant reads it. Sending first and showing
            // the precautions afterwards would be showing them after they mattered.
            const conversation = await getConversation();
            if (!conversation.acceptedPrecautions) {
                Alert.alert(
                    'A few things to read first',
                    'The assistant answers under precautions you have not seen yet. They take a minute, and this list will need to be entered again afterwards.',
                    [
                        { text: 'Not now', style: 'cancel' },
                        { text: 'Read them', onPress: () => router.push('/assistant/intro') },
                    ],
                );
                return;
            }
            if (conversation.available === false) {
                Toast.show({
                    type: 'error',
                    text1: 'The assistant is unavailable',
                    text2: 'It is not configured on the server right now. Please try later.',
                });
                return;
            }

            await sendMessage(buildAssistantMessage(draft));
            router.push('/(tabs)/assistant');
        } catch (error) {
            if (error instanceof ApiError && error.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            Toast.show({
                type: 'error',
                text1: 'Could not send this to the assistant',
                text2: error instanceof ApiError ? error.message : 'Please try again.',
            });
        } finally {
            setSending(false);
        }
    }, [draft, sending, router]);

    const showSuggestions = focused && query.trim().length >= 2;
    const ready = draft.symptomIds.length > 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.navBar}>
                    <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={26} color={Palette.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.title}>
                        {firstName ? `What are your symptoms, ${firstName}?` : 'What are your symptoms?'}
                    </Text>

                    <TouchableOpacity
                        style={[styles.search, focused && styles.searchFocused]}
                        activeOpacity={1}
                        onPress={() => inputRef.current?.focus()}
                    >
                        <Ionicons name="search" size={18} color={Palette.textSecondary} />
                        <TextInput
                            ref={inputRef}
                            style={styles.searchInput}
                            value={query}
                            onChangeText={setQuery}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder="Enter your symptoms…"
                            placeholderTextColor={Palette.textMuted}
                            autoCorrect={false}
                            returnKeyType="search"
                        />
                        {query.length > 0 && (
                            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                                <Ionicons name="close-circle" size={18} color={Palette.textMuted} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    {showSuggestions && (
                        <View style={styles.dropdown}>
                            {suggestions.length === 0 ? (
                                <Text style={styles.noMatch}>
                                    Nothing matches “{query.trim()}”. Try browsing by body area instead.
                                </Text>
                            ) : (
                                suggestions.map((symptom) => {
                                    const on = draft.symptomIds.includes(symptom.id);
                                    return (
                                        <TouchableOpacity
                                            key={symptom.id}
                                            style={[styles.suggestion, on && styles.suggestionOn]}
                                            onPress={() => toggle(symptom.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.suggestionText, on && styles.suggestionTextOn]}>
                                                {symptom.label}
                                            </Text>
                                            <Ionicons
                                                name={on ? 'remove' : 'add'}
                                                size={20}
                                                color={on ? Palette.primary : Palette.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {chosen.length > 0 && (
                        <View style={styles.chosenBlock}>
                            <Text style={styles.chosenLabel}>My symptoms</Text>
                            <View style={styles.chips}>
                                {chosen.map((symptom) => (
                                    <TouchableOpacity
                                        key={symptom.id}
                                        style={styles.chip}
                                        onPress={() => toggle(symptom.id)}
                                        activeOpacity={0.8}
                                        accessibilityLabel={`Remove ${symptom.label}`}
                                    >
                                        <Text style={styles.chipText}>{symptom.label}</Text>
                                        <Ionicons name="close" size={14} color={Palette.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {(draft.onset || draft.severity || draft.note.trim()) && (
                                <TouchableOpacity
                                    style={styles.detailSummary}
                                    onPress={() => setDetailing(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="document-text-outline" size={16} color={Palette.primary} />
                                    <Text style={styles.detailSummaryText}>
                                        {[
                                            draft.onset && 'when it started',
                                            draft.severity && 'how bad it feels',
                                            draft.note.trim() && 'your note',
                                        ].filter(Boolean).join(', ')} added
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {chosen.length === 0 && !showSuggestions && (
                        <View style={styles.empty}>
                            <Ionicons name="search-outline" size={26} color={Palette.textMuted} />
                            <Text style={styles.emptyText}>
                                Search for what you are feeling, or browse by body area below.
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <View style={styles.scoreRow}>
                        <Ionicons name="sparkles" size={16} color={Palette.amber} />
                        <Text style={styles.scoreLabel}>Symptom checker finding score</Text>
                    </View>
                    <View style={styles.track}>
                        <View style={[styles.fill, { width: `${score}%` }]} />
                    </View>
                    <Text style={styles.scoreCaption}>{nextStepFor(draft)}</Text>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.round}
                            onPress={() => setBrowsing(true)}
                            activeOpacity={0.8}
                            accessibilityLabel="Browse by body area"
                        >
                            <Ionicons name="body-outline" size={22} color={Palette.text} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.fab, !ready && styles.fabIdle]}
                            onPress={analyse}
                            disabled={!ready || sending}
                            activeOpacity={0.85}
                            accessibilityLabel="Analyse my symptoms"
                        >
                            {sending
                                ? <ActivityIndicator color={Palette.white} />
                                : <Ionicons name="search" size={26} color={ready ? Palette.white : Palette.primary} />}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.round, !ready && styles.roundDisabled]}
                            onPress={() => setDetailing(true)}
                            disabled={!ready}
                            activeOpacity={0.8}
                            accessibilityLabel="Add detail"
                        >
                            <Ionicons
                                name="options-outline"
                                size={22}
                                color={ready ? Palette.text : Palette.textMuted}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <BodyAreaSheet
                visible={browsing}
                selected={draft.symptomIds}
                onApply={(ids) => {
                    setDraft((prev) => ({ ...prev, symptomIds: ids }));
                    setBrowsing(false);
                }}
                onDismiss={() => setBrowsing(false)}
            />

            <DetailSheet
                visible={detailing}
                draft={draft}
                onApply={(detail) => {
                    setDraft((prev) => ({ ...prev, ...detail }));
                    setDetailing(false);
                }}
                onDismiss={() => setDetailing(false)}
            />
        </SafeAreaView>
    );
}

const GUTTER = Spacing.xxl;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },

    navBar: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },

    content: { paddingHorizontal: GUTTER, paddingBottom: Spacing.xxl },
    title: {
        fontSize: 26, lineHeight: 34, fontFamily: Fonts.bold, color: Palette.text,
        textAlign: 'center', marginTop: Spacing.lg, marginBottom: Spacing.xxl,
    },

    search: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        height: 54, paddingHorizontal: Spacing.lg,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white,
    },
    searchFocused: { borderColor: Palette.primary, borderWidth: 1.5 },
    searchInput: {
        flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text, padding: 0,
    },

    dropdown: {
        marginTop: Spacing.sm,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white, padding: Spacing.sm,
        ...Shadow.card,
    },
    suggestion: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
        borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent',
    },
    suggestionOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    suggestionText: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text },
    suggestionTextOn: { fontFamily: Fonts.medium, color: Palette.primary },
    noMatch: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        padding: Spacing.md, lineHeight: 20,
    },

    chosenBlock: { marginTop: Spacing.xxl },
    chosenLabel: {
        fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text,
        textAlign: 'center', marginBottom: Spacing.lg,
    },
    chips: {
        flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm,
    },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white,
    },
    chipText: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.text },

    detailSummary: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        alignSelf: 'center', marginTop: Spacing.lg,
        paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
        borderRadius: Radius.pill, backgroundColor: Palette.primarySurface,
    },
    detailSummaryText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.primary },

    empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 72, paddingHorizontal: Spacing.xl },
    emptyText: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textMuted,
        textAlign: 'center', lineHeight: 20,
    },

    footer: {
        paddingHorizontal: GUTTER, paddingTop: Spacing.lg, paddingBottom: Spacing.lg,
        borderTopWidth: 1, borderTopColor: Palette.borderLight, backgroundColor: Palette.white,
    },
    scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    scoreLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.amber },
    track: {
        height: 6, borderRadius: Radius.pill, backgroundColor: Palette.borderLight,
        marginTop: Spacing.md, overflow: 'hidden',
    },
    fill: { height: 6, minWidth: 8, borderRadius: Radius.pill, backgroundColor: Palette.primary },
    scoreCaption: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        textAlign: 'center', marginTop: Spacing.md,
    },

    actions: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.xl, marginTop: Spacing.xl,
    },
    round: {
        width: 48, height: 48, borderRadius: Radius.pill, backgroundColor: Palette.surface,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: Palette.border,
    },
    roundDisabled: { opacity: 0.5 },
    fab: {
        width: 68, height: 68, borderRadius: Radius.pill, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    fabIdle: { backgroundColor: Palette.primarySurface },
});
