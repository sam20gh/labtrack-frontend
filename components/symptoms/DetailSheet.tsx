/**
 * The three questions that change an answer: when it started, how bad it is, and anything
 * the person would say out loud.
 *
 * The kit puts these on their own screen ("Kaori, we still need some information") along
 * with medication and past conditions. Those two are already on the account — the
 * assistant reads them from `_gatherContext` — so re-asking would be asking someone to
 * retype what the app is holding, and would let the two copies disagree.
 *
 * Nothing here is required. The finding score on the page behind it shows what each answer
 * is worth, and a person who only wants to name a symptom and ask can still do that.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity, TextInput,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { Palette, Spacing, Radius, Fonts } from '@/constants/theme';
import { ONSETS, SEVERITIES, NOTE_LIMIT, type OnsetId, type SymptomDraft } from '@/lib/symptoms';

interface Props {
    visible: boolean;
    draft: SymptomDraft;
    onApply: (detail: Pick<SymptomDraft, 'onset' | 'severity' | 'note'>) => void;
    onDismiss: () => void;
}

export default function DetailSheet({ visible, draft, onApply, onDismiss }: Props) {
    const [onset, setOnset] = useState<OnsetId | null>(draft.onset);
    const [severity, setSeverity] = useState<number | null>(draft.severity);
    const [note, setNote] = useState(draft.note);

    useEffect(() => {
        if (!visible) return;
        setOnset(draft.onset);
        setSeverity(draft.severity);
        setNote(draft.note);
    }, [visible, draft.onset, draft.severity, draft.note]);

    const severityLabel = SEVERITIES.find((s) => s.level === severity)?.label;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
            <Pressable style={styles.backdrop} onPress={onDismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.lift}
                >
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.grabber} />

                        <View style={styles.header}>
                            <Text style={styles.title}>Add some detail</Text>
                            <TouchableOpacity onPress={onDismiss} hitSlop={12}>
                                <Ionicons name="close" size={22} color={Palette.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.subtitle}>
                            Your medications and conditions are already on your account — the
                            assistant reads those itself.
                        </Text>

                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={styles.bodyContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.label}>When did it start?</Text>
                            <View style={styles.chipRow}>
                                {ONSETS.map((option) => {
                                    const on = onset === option.id;
                                    return (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[styles.chip, on && styles.chipOn]}
                                            onPress={() => setOnset(on ? null : option.id)}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={[styles.chipText, on && styles.chipTextOn]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.label}>How bad does it feel at its worst?</Text>
                            <View style={styles.faceRow}>
                                {SEVERITIES.map((option) => {
                                    const on = severity === option.level;
                                    return (
                                        <TouchableOpacity
                                            key={option.level}
                                            style={[styles.face, on && styles.faceOn]}
                                            onPress={() => setSeverity(on ? null : option.level)}
                                            activeOpacity={0.85}
                                            accessibilityLabel={option.label}
                                        >
                                            <MaterialIcons
                                                name={option.icon}
                                                size={26}
                                                color={on ? Palette.primary : Palette.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text style={styles.faceCaption}>
                                {severityLabel ?? 'Tap the face that fits.'}
                            </Text>

                            <Text style={styles.label}>Anything else worth knowing?</Text>
                            <View style={styles.noteBox}>
                                <TextInput
                                    style={styles.note}
                                    value={note}
                                    onChangeText={(text) => setNote(text.slice(0, NOTE_LIMIT))}
                                    placeholder="What makes it better or worse, when it happens, what you have already tried…"
                                    placeholderTextColor={Palette.textMuted}
                                    multiline
                                    textAlignVertical="top"
                                />
                                <Text style={styles.counter}>{note.length}/{NOTE_LIMIT}</Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.apply}
                            onPress={() => onApply({ onset, severity, note })}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.applyText}>Apply</Text>
                        </TouchableOpacity>
                    </Pressable>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
    lift: { justifyContent: 'flex-end' },
    sheet: {
        maxHeight: '92%',
        backgroundColor: Palette.white,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl, paddingTop: Spacing.md,
    },
    grabber: {
        alignSelf: 'center', width: 40, height: 4, borderRadius: Radius.pill,
        backgroundColor: Palette.border, marginBottom: Spacing.lg,
    },

    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    title: { flex: 1, fontSize: 18, fontFamily: Fonts.bold, color: Palette.text },
    subtitle: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary,
        marginTop: Spacing.xs, lineHeight: 19,
    },

    body: { flexGrow: 0, marginTop: Spacing.lg },
    bodyContent: { paddingBottom: Spacing.lg },

    label: {
        fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text,
        marginBottom: Spacing.md, marginTop: Spacing.lg,
    },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.white,
    },
    chipOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    chipText: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.text },
    chipTextOn: { fontFamily: Fonts.medium, color: Palette.primary },

    faceRow: { flexDirection: 'row', gap: Spacing.md },
    face: {
        width: 52, height: 52, borderRadius: Radius.pill,
        borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    faceOn: { borderColor: Palette.primary, backgroundColor: Palette.primarySurface },
    faceCaption: {
        fontSize: 13, fontFamily: Fonts.regular, color: Palette.textSecondary, marginTop: Spacing.md,
    },

    noteBox: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl,
        backgroundColor: Palette.white, padding: Spacing.lg, paddingBottom: Spacing.sm,
    },
    note: {
        minHeight: 92, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text, padding: 0,
    },
    counter: {
        alignSelf: 'flex-end', fontSize: 12, fontFamily: Fonts.regular, color: Palette.textMuted,
    },

    apply: {
        height: 54, borderRadius: Radius.xl, backgroundColor: Palette.primary,
        alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md,
    },
    applyText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.white },
});
