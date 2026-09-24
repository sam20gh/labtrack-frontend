/**
 * Entry point for adding a lab result: scan a document or type it in.
 *
 * Automatic parsing can be unavailable (server not configured), so the scan options are
 * disabled rather than hidden — a greyed control with a reason is clearer than a menu that
 * silently changes shape.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getIngestionStatus, parseReportDocument } from '@/lib/reports';


import { makeStyles, usePalette } from '@/hooks/useTheme';
import { activePalette, tone } from '@/constants/theme';
export default function AddResultScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [automaticParsing, setAutomaticParsing] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getIngestionStatus()
            .then((s) => setAutomaticParsing(s.automaticParsing))
            .catch(() => setAutomaticParsing(false));
    }, []);

    const runParse = async (file: { uri: string; name: string; mimeType: string }) => {
        setBusy(true);
        try {
            const result = await parseReportDocument(file);
            if (!result.measurements.length) {
                Alert.alert(
                    'Nothing found',
                    "We couldn't find any test results in that document. You can enter them manually instead.",
                    [{ text: 'Enter manually', onPress: () => router.push('/add-result/manual') }, { text: 'Cancel' }]
                );
                return;
            }
            router.push({
                pathname: '/add-result/review',
                params: { payload: JSON.stringify(result) },
            });
        } catch (error) {
            Alert.alert(
                'Could not read the document',
                error instanceof Error ? error.message : 'Please try again or enter the values manually.',
                [{ text: 'Enter manually', onPress: () => router.push('/add-result/manual') }, { text: 'OK' }]
            );
        } finally {
            setBusy(false);
        }
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera access needed', 'Allow camera access to photograph a report.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
        if (result.canceled) return;
        const asset = result.assets[0];
        await runParse({
            uri: asset.uri,
            name: asset.fileName || 'report.jpg',
            mimeType: asset.mimeType || 'image/jpeg',
        });
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
        if (result.canceled) return;
        const asset = result.assets[0];
        await runParse({
            uri: asset.uri,
            name: asset.fileName || 'report.jpg',
            mimeType: asset.mimeType || 'image/jpeg',
        });
    };

    const pickPdf = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
        if (result.canceled) return;
        const asset = result.assets[0];
        await runParse({
            uri: asset.uri,
            name: asset.name || 'report.pdf',
            mimeType: 'application/pdf',
        });
    };

    const scanDisabled = automaticParsing === false || busy;

    const Option = ({ icon, title, subtitle, onPress, disabled }: any) => {
        const styles = useStyles();
        return (
            <TouchableOpacity
                style={[styles.option, disabled && styles.optionDisabled]}
                onPress={onPress}
                disabled={disabled}
            >
                <View style={styles.optionIcon}>
                    <Ionicons name={icon} size={24} color={disabled ? activePalette().textMuted : activePalette().primary} />
                </View>
                <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, disabled && styles.mutedText]}>{title}</Text>
                    <Text style={styles.optionSubtitle}>{subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tone('#D1D5DB')} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add a result</Text>
                <View style={styles.backButton} />
            </View>

            {busy ? (
                <View style={styles.busy}>
                    <ActivityIndicator size="large" color={Palette.primary} />
                    <Text style={styles.busyText}>Reading your report…</Text>
                    <Text style={styles.busyHint}>This can take up to a minute for a long report.</Text>
                </View>
            ) : (
                <View style={styles.content}>
                    <Text style={styles.lead}>
                        Add a blood test, scan, or panel. Values are checked against your personal
                        reference range.
                    </Text>

                    {automaticParsing === false && (
                        <View style={styles.notice}>
                            <Ionicons name="information-circle-outline" size={18} color={tone('#92400E')} />
                            <Text style={styles.noticeText}>
                                Automatic scanning is unavailable right now. You can still enter results manually.
                            </Text>
                        </View>
                    )}

                    <Option
                        icon="camera-outline"
                        title="Photograph a report"
                        subtitle="Use the camera to capture a printed result"
                        onPress={takePhoto}
                        disabled={scanDisabled}
                    />
                    <Option
                        icon="image-outline"
                        title="Choose a photo"
                        subtitle="Pick an existing image from your library"
                        onPress={pickImage}
                        disabled={scanDisabled}
                    />
                    <Option
                        icon="document-text-outline"
                        title="Upload a PDF"
                        subtitle="Select a report your lab emailed you"
                        onPress={pickPdf}
                        disabled={scanDisabled}
                    />

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <Option
                        icon="create-outline"
                        title="Enter values manually"
                        subtitle="Type results in yourself — always available"
                        onPress={() => router.push('/add-result/manual')}
                        disabled={busy}
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: Palette.text },
    content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
    lead: { fontSize: 15, color: Palette.textSecondary, lineHeight: 22, marginBottom: 24 },
    notice: {
        flexDirection: 'row', gap: 8, alignItems: 'flex-start',
        backgroundColor: tone('#FEF3C7'), borderRadius: 12, padding: 14, marginBottom: 20,
    },
    noticeText: { flex: 1, fontSize: 13, color: tone('#92400E'), lineHeight: 19 },
    option: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderWidth: 1, borderColor: Palette.border, borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 16, marginBottom: 12,
    },
    optionDisabled: { opacity: 0.5 },
    optionIcon: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: Palette.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    optionText: { flex: 1 },
    optionTitle: { fontSize: 15, fontWeight: '600', color: Palette.text, marginBottom: 2 },
    optionSubtitle: { fontSize: 13, color: Palette.textMuted },
    mutedText: { color: Palette.textMuted },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: Palette.border },
    dividerText: { fontSize: 12, color: Palette.textMuted, fontWeight: '600' },
    busy: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    busyText: { fontSize: 16, fontWeight: '600', color: Palette.text, marginTop: 20 },
    busyHint: { fontSize: 13, color: Palette.textMuted, marginTop: 8, textAlign: 'center' },
}));
