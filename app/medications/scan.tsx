/**
 * Scan a medicine.
 *
 * The design has a preflight screen ("Ensure the following"), then a full-bleed camera with
 * corner brackets and a live "80% long / 35mg" overlay. Two departures, both matching
 * decisions already made elsewhere in this app:
 *
 *   - **The system camera via `expo-image-picker`**, not a custom capture surface. Same
 *     capability, one fewer native module, no second permission prompt — the line the
 *     assistant's camera already takes.
 *   - **No live overlay.** The design shows a confidence reading updating while the camera
 *     is open. Identification here is one call after the shutter, so a live percentage would
 *     be theatre. The preflight advice is real and stays.
 *
 * The preflight is not decoration. A photograph of a box succeeds; a photograph of a loose
 * white tablet mostly does not, and telling someone that *before* they take it is the
 * difference between one attempt and four.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStatus, identifyMedication } from '@/lib/medications';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

const CHECKLIST = [
    {
        icon: 'cube-outline',
        title: 'The box beats the tablet',
        body: 'A printed name identifies a medicine. Thousands of generic tablets are round and white.',
    },
    {
        icon: 'sunny-outline',
        title: 'Good, even light',
        body: 'Daylight or a bright room. Avoid a shadow falling across the label.',
    },
    {
        icon: 'text-outline',
        title: 'Fill the frame with the text',
        body: 'Get close enough that the name and strength are readable to you.',
    },
];

export default function ScanScreen() {
    const router = useRouter();
    const [available, setAvailable] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getStatus().then((s) => setAvailable(s.scan)).catch(() => setAvailable(false));
    }, []);

    const run = async (asset: ImagePicker.ImagePickerAsset) => {
        setBusy(true);
        try {
            const result = await identifyMedication({
                uri: asset.uri,
                name: asset.fileName || 'medication.jpg',
                mimeType: asset.mimeType || 'image/jpeg',
            });

            if (!result.detected) {
                Alert.alert(
                    result.message || "We couldn't find your medication",
                    result.hint || 'Try the box or the blister strip rather than a loose tablet.',
                    [
                        { text: 'Enter by hand', onPress: () => router.replace('/medications/add') },
                        { text: 'Scan again' },
                    ]
                );
                return;
            }

            router.push({
                pathname: '/medications/scan-result',
                params: { payload: JSON.stringify(result), imageUri: asset.uri },
            });
        } catch (error) {
            Alert.alert(
                'Could not read that',
                error instanceof Error ? error.message : 'Try again, or enter the details by hand.',
                [
                    { text: 'Enter by hand', onPress: () => router.replace('/medications/add') },
                    { text: 'OK' },
                ]
            );
        } finally {
            setBusy(false);
        }
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera access needed', 'Allow camera access to photograph a medicine.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (result.canceled) return;
        await run(result.assets[0]);
    };

    const pickPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
        if (result.canceled) return;
        await run(result.assets[0]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan a medicine</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.illustration}>
                    <Ionicons name="scan-outline" size={44} color={Palette.primary} />
                </View>

                <Text style={styles.title}>Before you scan</Text>
                <Text style={styles.subtitle}>
                    A few seconds here saves several attempts.
                </Text>

                <View style={styles.checklist}>
                    {CHECKLIST.map((item) => (
                        <View key={item.title} style={styles.checkRow}>
                            <View style={styles.checkIcon}>
                                <Ionicons name={item.icon as any} size={17} color={Palette.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.checkTitle}>{item.title}</Text>
                                <Text style={styles.checkBody}>{item.body}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/*
                  What the scan is for, stated before it runs. It identifies; it does not
                  clear anything for use. Saying so here rather than after the result means
                  nobody reads a match as approval.
                */}
                <View style={styles.noteCard}>
                    <Ionicons name="information-circle-outline" size={16} color={Palette.textSecondary} />
                    <Text style={styles.note}>
                        Scanning identifies a medicine so you can add it. It does not tell you
                        whether to take it — nothing is added to your list until you confirm.
                    </Text>
                </View>

                {available === false ? (
                    <View style={styles.unavailable}>
                        <Ionicons name="cloud-offline-outline" size={17} color={Palette.textSecondary} />
                        <Text style={styles.unavailableText}>
                            Scanning is not available on this server right now. You can still
                            add a medication by hand or from our catalogue.
                        </Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[styles.primaryButton, (!available || busy) && styles.buttonDisabled]}
                    onPress={takePhoto}
                    disabled={!available || busy}
                    activeOpacity={0.85}
                >
                    {busy ? (
                        <ActivityIndicator color={Palette.white} size="small" />
                    ) : (
                        <Ionicons name="camera" size={18} color={Palette.white} />
                    )}
                    <Text style={styles.primaryButtonText}>
                        {busy ? 'Reading the label…' : "Got it, let's scan"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, (!available || busy) && styles.buttonDisabled]}
                    onPress={pickPhoto}
                    disabled={!available || busy}
                    activeOpacity={0.85}
                >
                    <Ionicons name="images-outline" size={17} color={Palette.primary} />
                    <Text style={styles.secondaryButtonText}>Choose an existing photo</Text>
                </TouchableOpacity>

                {/* Always available, whatever the server can do. */}
                <TouchableOpacity onPress={() => router.replace('/medications/add')} hitSlop={8}>
                    <Text style={styles.manual}>Enter the details by hand instead</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    },
    headerTitle: { fontSize: 17, color: Palette.text, fontFamily: Fonts.semibold },
    content: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },

    illustration: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
        alignSelf: 'center', marginBottom: Spacing.sm,
    },
    title: { fontSize: 21, color: Palette.text, fontFamily: Fonts.bold, textAlign: 'center' },
    subtitle: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.regular,
        textAlign: 'center', marginBottom: Spacing.md,
    },

    checklist: {
        backgroundColor: Palette.white,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Palette.border,
        padding: Spacing.lg,
        gap: Spacing.lg,
    },
    checkRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    checkIcon: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    checkTitle: { fontSize: 14, color: Palette.text, fontFamily: Fonts.semibold },
    checkBody: { fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18, marginTop: 2 },

    noteCard: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    note: { flex: 1, fontSize: 12, color: Palette.textSecondary, fontFamily: Fonts.regular, lineHeight: 18 },

    unavailable: {
        flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
        backgroundColor: Palette.warningSurface,
        borderRadius: Radius.md,
        padding: Spacing.md,
    },
    unavailableText: { flex: 1, fontSize: 12, color: Palette.warning, fontFamily: Fonts.regular, lineHeight: 18 },

    primaryButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primary, borderRadius: Radius.md, paddingVertical: 15,
        marginTop: Spacing.sm,
    },
    primaryButtonText: { fontSize: 15, color: Palette.white, fontFamily: Fonts.semibold },
    secondaryButton: {
        flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
        backgroundColor: Palette.primarySurface, borderRadius: Radius.md, paddingVertical: 15,
    },
    secondaryButtonText: { fontSize: 15, color: Palette.primary, fontFamily: Fonts.semibold },
    buttonDisabled: { opacity: 0.45 },
    manual: {
        fontSize: 13, color: Palette.textSecondary, fontFamily: Fonts.medium,
        textAlign: 'center', marginTop: Spacing.sm, textDecorationLine: 'underline',
    },
});
