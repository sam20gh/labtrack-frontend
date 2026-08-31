/**
 * Leave a feedback — `Design/profile.svg`, frame 19.
 *
 * The kit's version has topic chips, a message box and a Submit button that posts
 * somewhere. There is no feedback endpoint in `labtrack-backend`, and adding one is a
 * product decision (who reads it, where it lands, how it is retained) rather than a screen.
 *
 * So the composer is real and the delivery is email. That matters more than it sounds:
 * a Submit button that silently drops what someone wrote is the exact failure the
 * password-reset flow already has (`docs/KNOWN-ISSUES.md` — the screen navigates to the
 * confirmation page regardless of the response). Handing the draft to the mail client
 * means the person can see it leave, and has a copy in their sent folder.
 *
 * The button says "Send by email" for the same reason. "Submit Feedback" over a `mailto:`
 * would surprise someone at the moment their mail app opens.
 *
 * Version and platform are appended to the body because the first thing anyone triaging
 * this needs is which build it came from, and nobody knows their build number.
 */
import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, Pressable,
    Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import { SUPPORT_EMAIL, FEEDBACK_TOPICS } from '@/lib/help';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

const MAX_LENGTH = 1000;

export default function FeedbackScreen() {
    const router = useRouter();
    const [topics, setTopics] = useState<string[]>([]);
    const [message, setMessage] = useState('');

    const canSend = message.trim().length >= 10;

    const toggleTopic = (id: string) =>
        setTopics((current) =>
            current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
        );

    const subject = useMemo(() => {
        const labels = FEEDBACK_TOPICS.filter((t) => topics.includes(t.id)).map((t) => t.label);
        return labels.length ? `LabTrack feedback — ${labels.join(', ')}` : 'LabTrack feedback';
    }, [topics]);

    const send = async () => {
        const version = Constants.expoConfig?.version ?? '1.0.0';
        const body = [
            message.trim(),
            '',
            '---',
            `App version: ${version}`,
            `Platform: ${Platform.OS} ${Platform.Version}`,
        ].join('\n');

        const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const supported = await Linking.canOpenURL(url).catch(() => false);
        if (!supported) {
            // A phone with no mail client configured is common enough to handle rather
            // than let `openURL` reject into nothing.
            Toast.show({
                type: 'info',
                text1: 'No email app set up',
                text2: `Write to ${SUPPORT_EMAIL} from wherever you read mail.`,
            });
            return;
        }
        await Linking.openURL(url);
        router.back();
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <ScreenHeader
                        title="Leave a feedback"
                        subtitle="Tell us what is wrong, missing or confusing. We read all of it."
                    />

                    <View style={styles.body}>
                        <Text style={styles.label}>What is this about?</Text>
                        <View style={styles.chips}>
                            {FEEDBACK_TOPICS.map((topic) => {
                                const active = topics.includes(topic.id);
                                return (
                                    <Pressable
                                        key={topic.id}
                                        style={[styles.chip, active && styles.chipActive]}
                                        onPress={() => toggleTopic(topic.id)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: active }}
                                    >
                                        <Ionicons
                                            name={topic.icon as never}
                                            size={14}
                                            color={active ? Palette.primaryDark : Palette.textSecondary}
                                        />
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                            {topic.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.label}>Your message</Text>
                        <View style={styles.textAreaWrap}>
                            <TextInput
                                style={styles.textArea}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="What happened, and what did you expect instead?"
                                placeholderTextColor={Palette.textMuted}
                                multiline
                                textAlignVertical="top"
                                maxLength={MAX_LENGTH}
                            />
                            <Text style={styles.counter}>{message.length}/{MAX_LENGTH}</Text>
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.send,
                                !canSend && styles.sendDisabled,
                                pressed && canSend && styles.sendPressed,
                            ]}
                            onPress={send}
                            disabled={!canSend}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>
                                Send by email
                            </Text>
                            <Ionicons
                                name="mail-outline"
                                size={18}
                                color={canSend ? Palette.white : Palette.textMuted}
                            />
                        </Pressable>

                        <Text style={styles.footnote}>
                            This opens your email app with the message ready to send, so you keep a copy. Please
                            do not include test results or anything you would not want in an email — for
                            questions about your own health, use the assistant instead.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    scroll: { paddingBottom: 48 },
    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.md },

    label: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginTop: Spacing.sm },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: Spacing.md, paddingVertical: 9,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.background,
    },
    chipActive: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    chipTextActive: { color: Palette.primaryDark },

    textAreaWrap: {
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl,
        backgroundColor: Palette.background, padding: Spacing.lg, gap: Spacing.sm,
    },
    textArea: {
        minHeight: 140, fontSize: 14, lineHeight: 20,
        fontFamily: Fonts.regular, color: Palette.text,
    },
    counter: { alignSelf: 'flex-end', fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted },

    send: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.xl,
        paddingVertical: 16, marginTop: Spacing.sm,
    },
    sendPressed: { backgroundColor: Palette.primaryDark },
    sendDisabled: { backgroundColor: Palette.borderLight },
    sendText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },
    sendTextDisabled: { color: Palette.textMuted },

    footnote: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textMuted,
        marginTop: Spacing.xs,
    },
});
