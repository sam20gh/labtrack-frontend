/**
 * First run of the AI assistant: what it is, what it is not, and how you want to talk to it.
 *
 * Three of the kit's screens, built as one paged screen rather than three routes. The kit
 * draws pagination dots on the precautions screen, which is the tell — these are steps in
 * one decision, not destinations, and as separate routes the back gesture would let someone
 * land on the mode picker having skipped the limitations.
 *
 * The middle step is the one that matters. An assistant that reads someone's blood results
 * and answers in the voice of "Dr. LabTrack" will be read as medical advice unless it says
 * plainly that it is not, before the first message rather than in a footer afterwards.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/lib/api';
import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import { savePreferences, type AssistantMode } from '@/lib/assistant';

const PRECAUTIONS = [
    {
        icon: 'medkit-outline' as const,
        title: 'Not a substitute for medical advice',
        body: 'It can explain what your results say and what tends to follow from them. It cannot diagnose you, and it does not replace your doctor.',
    },
    {
        icon: 'file-tray-outline' as const,
        title: 'It only knows what you have given it',
        body: 'Its answers come from the results, reports and assessment in your account. Anything you have not recorded here, it cannot see.',
    },
    {
        icon: 'alert-circle-outline' as const,
        title: 'Check anything that matters',
        body: 'It can be wrong, and lab values can be entered wrong. Confirm anything you intend to act on with a clinician.',
    },
];

const MODES: { value: AssistantMode; icon: 'chatbubbles-outline' | 'planet-outline'; title: string; body: string }[] = [
    {
        value: 'chat',
        icon: 'chatbubbles-outline',
        title: 'Chat',
        body: 'A conversation you can scroll back through, with your results shown as cards.',
    },
    {
        value: 'immersive',
        icon: 'planet-outline',
        title: 'Immersive',
        body: 'One question at a time on a full screen, with the answer front and centre.',
    },
];

export default function AssistantIntro() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [mode, setMode] = useState<AssistantMode>('chat');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const finish = async () => {
        setSaving(true);
        setError(null);
        try {
            await savePreferences({ mode, acceptedPrecautions: true });
            // `replace`, not `push`: once accepted, the back gesture must not return to a
            // consent screen the person has already answered.
            router.replace(mode === 'immersive' ? '/assistant/immersive' : '/(tabs)/assistant');
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) {
                router.replace('/(auth)/loginscreen');
                return;
            }
            setError(err instanceof ApiError ? err.message : 'Could not save your choice.');
            setSaving(false);
        }
    };

    const next = () => (step < 2 ? setStep(step + 1) : finish());

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
                {step > 0 ? (
                    <TouchableOpacity onPress={() => setStep(step - 1)} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={24} color={Palette.text} />
                    </TouchableOpacity>
                ) : <View style={styles.topBarSpacer} />}
                <View style={styles.dots}>
                    {[0, 1, 2].map((i) => (
                        <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
                    ))}
                </View>
                <View style={styles.topBarSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                {step === 0 ? (
                    <View style={styles.stepBlock}>
                        <View style={styles.hero}>
                            <Ionicons name="sparkles" size={34} color={Palette.white} />
                        </View>
                        <Text style={styles.title}>Your health data, finally answerable</Text>
                        <Text style={styles.lede}>
                            Ask about a marker that moved, what is next on your plan, or whether a result is
                            worth worrying about. It answers from your records — not from health advice in
                            general.
                        </Text>
                    </View>
                ) : null}

                {step === 1 ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.title}>Before you start</Text>
                        <View style={styles.list}>
                            {PRECAUTIONS.map((p) => (
                                <View key={p.title} style={styles.listItem}>
                                    <View style={styles.listIcon}>
                                        <Ionicons name={p.icon} size={18} color={Palette.primary} />
                                    </View>
                                    <View style={styles.listText}>
                                        <Text style={styles.listTitle}>{p.title}</Text>
                                        <Text style={styles.listBody}>{p.body}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {step === 2 ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.title}>How would you like to interact?</Text>
                        <Text style={styles.lede}>You can change this whenever you like.</Text>
                        <View style={styles.list}>
                            {MODES.map((m) => {
                                const selected = mode === m.value;
                                return (
                                    <TouchableOpacity
                                        key={m.value}
                                        style={[styles.modeCard, selected && styles.modeCardSelected]}
                                        onPress={() => setMode(m.value)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected }}
                                    >
                                        <View style={[styles.listIcon, selected && styles.listIconSelected]}>
                                            <Ionicons
                                                name={m.icon}
                                                size={18}
                                                color={selected ? Palette.white : Palette.primary}
                                            />
                                        </View>
                                        <View style={styles.listText}>
                                            <Text style={styles.listTitle}>{m.title}</Text>
                                            <Text style={styles.listBody}>{m.body}</Text>
                                        </View>
                                        <Ionicons
                                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={selected ? Palette.primary : Palette.border}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.cta, saving && styles.ctaDisabled]}
                    onPress={next}
                    disabled={saving}
                >
                    {saving
                        ? <ActivityIndicator color={Palette.white} />
                        : <Text style={styles.ctaText}>{step === 2 ? 'Start' : step === 1 ? 'I understand' : 'Continue'}</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.background },

    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    topBarSpacer: { width: 24 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.border },
    dotActive: { backgroundColor: Palette.primary, width: 20 },

    body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
    stepBlock: { gap: Spacing.lg },

    hero: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
    },
    title: { fontSize: 27, lineHeight: 34, fontFamily: Fonts.bold, color: Palette.text },
    lede: { fontSize: 14, lineHeight: 21, fontFamily: Fonts.regular, color: Palette.textSecondary },

    list: { gap: Spacing.md, marginTop: Spacing.sm },
    listItem: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    listIcon: {
        width: 38, height: 38, borderRadius: Radius.lg, backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    listIconSelected: { backgroundColor: Palette.primary },
    listText: { flex: 1, gap: 3 },
    listTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    listBody: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textSecondary },

    modeCard: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl, padding: Spacing.lg,
    },
    modeCardSelected: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },

    error: { marginTop: Spacing.lg, fontSize: 13, fontFamily: Fonts.medium, color: Palette.danger },

    footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, paddingTop: Spacing.sm },
    cta: {
        height: 52, borderRadius: Radius.xl, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    ctaDisabled: { opacity: 0.6 },
    ctaText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
});
