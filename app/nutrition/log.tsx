/**
 * How to log a meal — photo, description, or by hand.
 *
 * The three options are always shown, with the AI ones disabled and explained when the
 * server has no key configured. `add-result/index.tsx` takes the same line: a greyed
 * control with a reason is clearer than a menu that silently changes shape.
 *
 * Manual entry sits at the bottom and always works. It is the fallback when the analyser
 * refuses, misreads, or is switched off, and a tracker where logging can fail outright is a
 * tracker people abandon.
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
    getStatus, analysePhoto, estimateFromDescription, logMeal, mealTypeForNow,
} from '@/lib/nutrition';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { AnalysisResult } from '@/lib/nutrition';

export default function LogMealScreen() {
    const router = useRouter();
    const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    // Manual entry, revealed rather than pushed: it is three fields, and a screen for three
    // fields is a screen too many when the person is standing over their lunch.
    const [manual, setManual] = useState(false);
    const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

    useEffect(() => {
        getStatus()
            .then((s) => setAiAvailable(s.photoAnalysis))
            .catch(() => setAiAvailable(false));
    }, []);

    const toReview = (result: AnalysisResult, imageUri?: string) => {
        router.replace({
            pathname: '/nutrition/review',
            params: { payload: JSON.stringify(result), imageUri: imageUri || '' },
        });
    };

    const runPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
        setBusy('photo');
        try {
            const result = await analysePhoto({
                uri: asset.uri,
                name: asset.fileName || 'meal.jpg',
                mimeType: asset.mimeType || 'image/jpeg',
            });
            toReview(result, asset.uri);
        } catch (error) {
            Alert.alert(
                "We couldn't detect the food",
                error instanceof Error ? error.message : 'Try again in better light, or enter it by hand.',
                [{ text: 'Enter by hand', onPress: () => setManual(true) }, { text: 'OK' }]
            );
        } finally {
            setBusy(null);
        }
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera access needed', 'Allow camera access to photograph a meal.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (result.canceled) return;
        await runPhoto(result.assets[0]);
    };

    const pickPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (result.canceled) return;
        await runPhoto(result.assets[0]);
    };

    const runDescription = async () => {
        if (description.trim().length < 3) return;
        setBusy('description');
        try {
            toReview(await estimateFromDescription(description.trim()));
        } catch (error) {
            Alert.alert(
                'Could not estimate that',
                error instanceof Error ? error.message : 'Try describing the food and roughly how much.',
                [{ text: 'Enter by hand', onPress: () => setManual(true) }, { text: 'OK' }]
            );
        } finally {
            setBusy(null);
        }
    };

    const saveManual = async () => {
        const calories = Number(form.calories);
        if (!form.name.trim() || !Number.isFinite(calories) || calories <= 0) {
            Alert.alert('Missing details', 'A name and a calorie figure are needed.');
            return;
        }
        setBusy('manual');
        try {
            await logMeal({
                name: form.name.trim(),
                calories: Math.round(calories),
                protein: Number(form.protein) || 0,
                carbs: Number(form.carbs) || 0,
                fat: Number(form.fat) || 0,
                mealType: mealTypeForNow(),
                source: 'manual',
            });
            router.back();
        } catch (error) {
            Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <Ionicons name="close" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Log your meal</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.subtitle}>Please select how you&apos;d like to log your meal.</Text>

                    <TouchableOpacity
                        style={[styles.option, aiAvailable === false && styles.optionDisabled]}
                        onPress={takePhoto}
                        disabled={aiAvailable === false || busy !== null}
                    >
                        <View style={styles.optionIcon}>
                            {busy === 'photo'
                                ? <ActivityIndicator size="small" color={Palette.primary} />
                                : <Ionicons name="camera-outline" size={20} color={Palette.primary} />}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.optionTitle}>Take a photo</Text>
                            <Text style={styles.optionBody}>
                                {aiAvailable === false
                                    ? 'Unavailable — the analyser is not configured on the server.'
                                    : 'We estimate the calories and macros, and check it against your plan.'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.option, aiAvailable === false && styles.optionDisabled]}
                        onPress={pickPhoto}
                        disabled={aiAvailable === false || busy !== null}
                    >
                        <View style={styles.optionIcon}>
                            <Ionicons name="images-outline" size={20} color={Palette.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.optionTitle}>Choose a photo</Text>
                            <Text style={styles.optionBody}>From your photo library.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
                    </TouchableOpacity>

                    <View style={styles.describeCard}>
                        <Text style={styles.optionTitle}>Describe it</Text>
                        <Text style={styles.optionBody}>
                            What you ate and roughly how much.
                        </Text>
                        <TextInput
                            style={styles.describeInput}
                            placeholder="e.g. grilled salmon with new potatoes and greens"
                            placeholderTextColor={Palette.textMuted}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            editable={aiAvailable !== false && busy === null}
                        />
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                (description.trim().length < 3 || aiAvailable === false) && styles.buttonDisabled,
                            ]}
                            onPress={runDescription}
                            disabled={description.trim().length < 3 || aiAvailable === false || busy !== null}
                        >
                            {busy === 'description'
                                ? <ActivityIndicator size="small" color={Palette.white} />
                                : <Text style={styles.primaryButtonText}>Estimate</Text>}
                        </TouchableOpacity>
                    </View>

                    {!manual ? (
                        <TouchableOpacity style={styles.manualLink} onPress={() => setManual(true)}>
                            <Ionicons name="create-outline" size={16} color={Palette.textSecondary} />
                            <Text style={styles.manualLinkText}>Enter the numbers by hand</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.describeCard}>
                            <Text style={styles.optionTitle}>Enter by hand</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="What did you eat?"
                                placeholderTextColor={Palette.textMuted}
                                value={form.name}
                                onChangeText={(name) => setForm((f) => ({ ...f, name }))}
                            />
                            <View style={styles.numberRow}>
                                {(['calories', 'protein', 'carbs', 'fat'] as const).map((field) => (
                                    <View key={field} style={styles.numberField}>
                                        <TextInput
                                            style={[styles.input, styles.numberInput]}
                                            placeholder="0"
                                            placeholderTextColor={Palette.textMuted}
                                            keyboardType="numeric"
                                            value={form[field]}
                                            onChangeText={(v) => setForm((f) => ({ ...f, [field]: v }))}
                                        />
                                        <Text style={styles.numberLabel}>
                                            {field === 'calories' ? 'kcal' : `${field} g`}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={saveManual}
                                disabled={busy !== null}
                            >
                                {busy === 'manual'
                                    ? <ActivityIndicator size="small" color={Palette.white} />
                                    : <Text style={styles.primaryButtonText}>Save meal</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Palette.canvas },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    title: { fontFamily: Fonts.bold, fontSize: 18, color: Palette.text },
    content: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.md, paddingBottom: Spacing.xxxl },
    subtitle: {
        fontFamily: Fonts.regular,
        fontSize: 14,
        color: Palette.textSecondary,
        marginBottom: Spacing.xs,
    },

    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
    },
    optionDisabled: { opacity: 0.5 },
    optionIcon: {
        width: 40,
        height: 40,
        borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTitle: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.text },
    optionBody: {
        fontFamily: Fonts.regular,
        fontSize: 12,
        color: Palette.textSecondary,
        lineHeight: 17,
        marginTop: 2,
    },

    describeCard: {
        backgroundColor: Palette.background,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Palette.borderSlate,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    describeInput: {
        fontFamily: Fonts.regular,
        fontSize: 14,
        color: Palette.text,
        backgroundColor: Palette.canvas,
        borderRadius: Radius.md,
        padding: Spacing.md,
        minHeight: 72,
        textAlignVertical: 'top',
    },
    input: {
        fontFamily: Fonts.regular,
        fontSize: 14,
        color: Palette.text,
        backgroundColor: Palette.canvas,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    numberRow: { flexDirection: 'row', gap: Spacing.sm },
    numberField: { flex: 1 },
    numberInput: { textAlign: 'center' },
    numberLabel: {
        fontFamily: Fonts.regular,
        fontSize: 11,
        color: Palette.textMuted,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },

    primaryButton: {
        height: 48,
        borderRadius: Radius.md,
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.4 },
    primaryButtonText: { fontFamily: Fonts.semibold, fontSize: 15, color: Palette.white },

    manualLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
    },
    manualLinkText: { fontFamily: Fonts.medium, fontSize: 14, color: Palette.textSecondary },
});
