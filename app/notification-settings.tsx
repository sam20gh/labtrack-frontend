/**
 * Notification preferences.
 *
 * Also the place someone lands when they want notifications *off* — which matters: an app
 * that makes muting hard gets uninstalled rather than muted.
 */
import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity,
    ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import {
    getPreferences, updatePreferences, registerForPushNotifications,
    getPermissionStatus, sendTestNotification, type NotificationPreferences,
} from '@/lib/notifications';

const OFFSET_CHOICES = [
    { days: 30, label: '1 month before' },
    { days: 14, label: '2 weeks before' },
    { days: 7, label: '1 week before' },
    { days: 1, label: '1 day before' },
    { days: 0, label: 'On the day' },
];

export default function NotificationSettingsScreen() {
    const router = useRouter();
    const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
    const [deviceCount, setDeviceCount] = useState(0);
    const [permission, setPermission] = useState<string>('undetermined');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const [{ preferences, deviceCount: count }, status] = await Promise.all([
                getPreferences(),
                getPermissionStatus(),
            ]);
            setPrefs(preferences);
            setDeviceCount(count);
            setPermission(status);
        } catch {
            Toast.show({ type: 'error', text1: 'Could not load your settings' });
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const save = async (patch: Partial<NotificationPreferences>) => {
        const optimistic = { ...prefs, ...patch } as NotificationPreferences;
        setPrefs(optimistic);
        setSaving(true);
        try {
            const { preferences } = await updatePreferences(patch);
            setPrefs(preferences);
        } catch {
            await load();  // revert to whatever the server actually holds
            Toast.show({ type: 'error', text1: 'Could not save that change' });
        } finally {
            setSaving(false);
        }
    };

    const enableOnDevice = async () => {
        const result = await registerForPushNotifications();
        if (!result.granted) {
            Toast.show({
                type: 'error',
                text1: 'Not enabled',
                text2: result.reason,
                // Once iOS permission is denied it can only be changed in Settings
                onPress: () => Linking.openSettings(),
            });
        } else {
            Toast.show({ type: 'success', text1: 'This device will receive reminders' });
        }
        await load();
    };

    const test = async () => {
        try {
            const result = await sendTestNotification();
            Toast.show({ type: 'success', text1: 'Test sent', text2: `Delivered to ${result.sent} device(s)` });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Nothing sent', text2: (error as Error).message });
        }
    };

    if (loading || !prefs) {
        return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></View></SafeAreaView>;
    }

    const toggleOffset = (days: number) => {
        const current = prefs.offsetDays ?? [];
        const next = current.includes(days)
            ? current.filter((d) => d !== days)
            : [...current, days].sort((a, b) => b - a);
        save({ offsetDays: next });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={styles.backButton} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {permission !== 'granted' && (
                    <View style={styles.notice}>
                        <Ionicons name="notifications-off-outline" size={20} color="#92400E" />
                        <View style={styles.flex}>
                            <Text style={styles.noticeTitle}>Notifications are off on this device</Text>
                            <Text style={styles.noticeText}>
                                We'll remind you when a screening is due, and tell you when results arrive.
                            </Text>
                            <TouchableOpacity style={styles.noticeButton} onPress={enableOnDevice}>
                                <Text style={styles.noticeButtonText}>
                                    {permission === 'denied' ? 'Open Settings' : 'Turn on'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {permission === 'granted' && deviceCount > 0 && (
                    <View style={styles.okNotice}>
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                        <Text style={styles.okNoticeText}>
                            {deviceCount === 1 ? 'This device is' : `${deviceCount} devices are`} set up for notifications
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionLabel}>What we send</Text>

                <View style={styles.row}>
                    <View style={styles.flex}>
                        <Text style={styles.rowTitle}>All notifications</Text>
                        <Text style={styles.rowSub}>Turning this off silences everything below</Text>
                    </View>
                    <Switch
                        value={prefs.enabled}
                        onValueChange={(v) => save({ enabled: v })}
                        trackColor={{ true: '#7C3AED' }}
                        disabled={saving}
                    />
                </View>

                <View style={[styles.row, !prefs.enabled && styles.rowDisabled]}>
                    <View style={styles.flex}>
                        <Text style={styles.rowTitle}>Overdue reminders</Text>
                        <Text style={styles.rowSub}>Weekly, while something remains overdue</Text>
                    </View>
                    <Switch
                        value={prefs.overdueReminders}
                        onValueChange={(v) => save({ overdueReminders: v })}
                        trackColor={{ true: '#7C3AED' }}
                        disabled={saving || !prefs.enabled}
                    />
                </View>

                <View style={[styles.row, !prefs.enabled && styles.rowDisabled]}>
                    <View style={styles.flex}>
                        <Text style={styles.rowTitle}>Order updates</Text>
                        <Text style={styles.rowSub}>When your kit is dispatched or your sample arrives</Text>
                    </View>
                    <Switch
                        value={prefs.orderUpdates}
                        onValueChange={(v) => save({ orderUpdates: v })}
                        trackColor={{ true: '#7C3AED' }}
                        disabled={saving || !prefs.enabled}
                    />
                </View>

                <View style={[styles.row, !prefs.enabled && styles.rowDisabled]}>
                    <View style={styles.flex}>
                        <Text style={styles.rowTitle}>Results ready</Text>
                        <Text style={styles.rowSub}>When new results reach your record</Text>
                    </View>
                    <Switch
                        value={prefs.resultsReady}
                        onValueChange={(v) => save({ resultsReady: v })}
                        trackColor={{ true: '#7C3AED' }}
                        disabled={saving || !prefs.enabled}
                    />
                </View>

                <Text style={styles.sectionLabel}>When to remind you</Text>
                <Text style={styles.sectionHint}>Before a screening or appointment is due</Text>

                <View style={styles.chips}>
                    {OFFSET_CHOICES.map((choice) => {
                        const active = (prefs.offsetDays ?? []).includes(choice.days);
                        return (
                            <TouchableOpacity
                                key={choice.days}
                                style={[styles.chip, active && styles.chipActive, !prefs.enabled && styles.rowDisabled]}
                                onPress={() => toggleOffset(choice.days)}
                                disabled={saving || !prefs.enabled}
                            >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{choice.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.sectionLabel}>Quiet hours</Text>
                <Text style={styles.sectionHint}>
                    Nothing is sent between {String(prefs.quietHours?.start ?? 22).padStart(2, '0')}:00 and{' '}
                    {String(prefs.quietHours?.end ?? 8).padStart(2, '0')}:00. A reminder that falls in this
                    window goes out the next morning instead.
                </Text>

                {permission === 'granted' && deviceCount > 0 && (
                    <TouchableOpacity style={styles.testButton} onPress={test}>
                        <Ionicons name="paper-plane-outline" size={18} color="#7C3AED" />
                        <Text style={styles.testButtonText}>Send a test notification</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
    },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    notice: {
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 16,
    },
    noticeTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
    noticeText: { fontSize: 12, color: '#92400E', lineHeight: 18, marginTop: 3 },
    noticeButton: {
        backgroundColor: '#92400E', alignSelf: 'flex-start',
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginTop: 10,
    },
    noticeButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    okNotice: {
        flexDirection: 'row', gap: 8, alignItems: 'center',
        backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 16,
    },
    okNoticeText: { fontSize: 13, color: '#059669', fontWeight: '500' },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 20, marginBottom: 4 },
    sectionHint: { fontSize: 12, color: '#9CA3AF', lineHeight: 18, marginBottom: 12 },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    rowDisabled: { opacity: 0.45 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
    rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    chipText: { fontSize: 13, color: '#6B7280' },
    chipTextActive: { color: '#fff', fontWeight: '600' },
    testButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, marginTop: 28,
    },
    testButtonText: { color: '#7C3AED', fontSize: 14, fontWeight: '600' },
});
