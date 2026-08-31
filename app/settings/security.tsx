/**
 * Security Settings — `Design/profile.svg`, frame 3.
 *
 * The kit lists six controls: Enable PIN Code, Biometric Login, Remember Login, Use FaceID,
 * Account recovery, Log Out From All Devices. Three of those are real here and three are
 * not, and the split is the whole design of this screen.
 *
 * **Two of the six ship as switches, because they work.** "Remember Login" is the
 * `keepSignedIn` flag `lib/auth.ts` already stores and `SplashScreen.tsx` already reads.
 * "Log Out From All Devices" is `supabase.auth.signOut({ scope: 'global' })`, which
 * revokes every refresh token on the account server-side — a real button with a real
 * consequence, so it confirms first.
 *
 * **PIN code, biometric login and Face ID are drawn disabled with a reason.** There is no
 * `expo-local-authentication` in `package.json`, so nothing on this device can check a
 * fingerprint or a face. A switch that flips and protects nothing is worse than no switch:
 * it is a security control someone would believe they had turned on. This is the same call
 * `InputDock` makes for the microphone when `capabilities.voice` is false — the control
 * arrives greyed with the reason attached rather than live and failing on tap.
 *
 * Changing a password goes through Supabase's reset email rather than an in-app
 * old-password/new-password pair (kit frames 27–28). Supabase owns the credential; asking
 * for the current password in this app would mean handling it here to prove something the
 * identity provider is already the authority on.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import { supabase } from '@/constants/supabase';
import { STORAGE_KEYS, sendPasswordResetEmail, signOut } from '@/lib/auth';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';

/** The three the kit draws that this build cannot honour, with what each one is waiting on. */
const UNAVAILABLE = [
    {
        icon: 'keypad-outline',
        title: 'PIN code',
        blurb: 'Unlock LabTrack with a 4-digit PIN',
        reason: 'Needs on-device authentication, which this build does not include yet.',
    },
    {
        icon: 'finger-print-outline',
        title: 'Biometric login',
        blurb: 'Unlock with your fingerprint',
        reason: 'Needs on-device authentication, which this build does not include yet.',
    },
    {
        icon: 'scan-outline',
        title: 'Face ID',
        blurb: 'Unlock by looking at your phone',
        reason: 'Needs on-device authentication, which this build does not include yet.',
    },
] as const;

export default function SecuritySettingsScreen() {
    const router = useRouter();
    const [keepSignedIn, setKeepSignedIn] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<'reset' | 'global' | null>(null);

    const load = useCallback(async () => {
        const [flag, { data }] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.keepSignedIn),
            supabase.auth.getUser(),
        ]);
        setKeepSignedIn(flag === 'true');
        setEmail(data.user?.email ?? null);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const toggleKeepSignedIn = async (next: boolean) => {
        setKeepSignedIn(next); // optimistic: a switch that lags reads as broken
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.keepSignedIn, next ? 'true' : 'false');
        } catch {
            setKeepSignedIn(!next);
            Toast.show({ type: 'error', text1: 'Could not save that' });
        }
    };

    /**
     * Sends the reset mail to the address on the account, not to one typed here — typing
     * an address on this screen would let a borrowed, signed-in phone redirect the reset.
     */
    const changePassword = async () => {
        if (!email) {
            Toast.show({
                type: 'info',
                text1: 'No email on this account',
                text2: 'Password changes are handled by whoever you signed in with.',
            });
            return;
        }
        setBusy('reset');
        await sendPasswordResetEmail(email);
        setBusy(null);
        Toast.show({
            type: 'success',
            text1: 'Check your email',
            text2: `We sent a password reset link to ${email}.`,
        });
    };

    /**
     * Revokes every refresh token on the account. This phone included — there is no way to
     * sign out other devices while keeping this one, so the screen says so before doing it.
     */
    const signOutEverywhere = () => {
        Alert.alert(
            'Sign out of all devices?',
            'This signs you out here as well. You will need to sign in again on every device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign out everywhere',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy('global');
                        try {
                            await supabase.auth.signOut({ scope: 'global' });
                        } catch {
                            // Local state is cleared below regardless — a session this app
                            // cannot see is worse than one the server still holds.
                        }
                        await signOut();
                        router.replace('/(auth)/loginscreen');
                    },
                },
            ],
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.screen, styles.center]} edges={['top']}>
                <ActivityIndicator size="large" color={Palette.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <ScreenHeader
                    title="Security Settings"
                    subtitle="Your health privacy matters. Control and own your data here."
                />

                <View style={styles.body}>
                    <View style={styles.group}>
                        <View style={styles.row}>
                            <View style={styles.rowIcon}>
                                <Ionicons name="log-in-outline" size={18} color={Palette.primary} />
                            </View>
                            <View style={styles.rowText}>
                                <Text style={styles.rowTitle}>Remember login</Text>
                                <Text style={styles.rowBlurb}>Stay signed in on this device</Text>
                            </View>
                            <Switch
                                value={keepSignedIn}
                                onValueChange={toggleKeepSignedIn}
                                trackColor={{ false: Palette.border, true: Palette.primary }}
                                thumbColor={Palette.white}
                            />
                        </View>

                        <Pressable
                            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                            onPress={changePassword}
                            disabled={busy === 'reset'}
                            accessibilityRole="button"
                        >
                            <View style={styles.rowIcon}>
                                <Ionicons name="lock-closed-outline" size={18} color={Palette.primary} />
                            </View>
                            <View style={styles.rowText}>
                                <Text style={styles.rowTitle}>Change password</Text>
                                <Text style={styles.rowBlurb} numberOfLines={1}>
                                    {email ? `We'll email a link to ${email}` : 'No email on this account'}
                                </Text>
                            </View>
                            {busy === 'reset'
                                ? <ActivityIndicator size="small" color={Palette.primary} />
                                : <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />}
                        </Pressable>

                        <Pressable
                            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
                            onPress={signOutEverywhere}
                            disabled={busy === 'global'}
                            accessibilityRole="button"
                        >
                            <View style={[styles.rowIcon, styles.rowIconDanger]}>
                                <Ionicons name="exit-outline" size={18} color={Palette.danger} />
                            </View>
                            <View style={styles.rowText}>
                                <Text style={[styles.rowTitle, styles.rowTitleDanger]}>Log out from all devices</Text>
                                <Text style={styles.rowBlurb}>Signs you out here too</Text>
                            </View>
                            {busy === 'global'
                                ? <ActivityIndicator size="small" color={Palette.danger} />
                                : <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />}
                        </Pressable>
                    </View>

                    <Text style={styles.groupLabel}>Not available yet</Text>
                    <View style={styles.group}>
                        {UNAVAILABLE.map((item, index) => (
                            <View
                                key={item.title}
                                style={[styles.row, index === UNAVAILABLE.length - 1 && styles.rowLast]}
                            >
                                <View style={[styles.rowIcon, styles.rowIconMuted]}>
                                    <Ionicons name={item.icon as never} size={18} color={Palette.textMuted} />
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={[styles.rowTitle, styles.rowTitleMuted]}>{item.title}</Text>
                                    <Text style={styles.rowBlurb}>{item.blurb}</Text>
                                </View>
                                {/* Disabled rather than absent: someone looking for a fingerprint
                                    unlock should find out it is coming, not conclude it is hidden. */}
                                <Switch
                                    value={false}
                                    disabled
                                    trackColor={{ false: Palette.borderLight, true: Palette.borderLight }}
                                    thumbColor={Palette.border}
                                />
                            </View>
                        ))}
                    </View>
                    <Text style={styles.footnote}>{UNAVAILABLE[0].reason}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 48 },
    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.md },

    groupLabel: {
        fontSize: 12, fontFamily: Fonts.semibold, color: Palette.textMuted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginTop: Spacing.lg,
    },
    group: {
        backgroundColor: Palette.surface, borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Palette.border, overflow: 'hidden',
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Palette.border,
        minHeight: 64,
    },
    rowLast: { borderBottomWidth: 0 },
    rowPressed: { backgroundColor: Palette.borderLight },
    rowIcon: {
        width: 34, height: 34, borderRadius: Radius.md,
        backgroundColor: Palette.primarySurface, alignItems: 'center', justifyContent: 'center',
    },
    rowIconDanger: { backgroundColor: Palette.dangerSurface },
    rowIconMuted: { backgroundColor: Palette.borderLight },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    rowTitleDanger: { color: Palette.danger },
    rowTitleMuted: { color: Palette.textSecondary },
    rowBlurb: { fontSize: 12, fontFamily: Fonts.regular, color: Palette.textSecondary },

    footnote: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textMuted,
        marginTop: Spacing.xs,
    },
});
