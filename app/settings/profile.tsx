/**
 * Profile Settings — `Design/profile.svg`, frame 11.
 *
 * Replaces `app/users.tsx`, which was the last screen in the app still drawing itself with
 * `react-native-paper` `Card`/`Button` on the default Material palette. It sat behind the
 * profile hub's identity row, so the one screen you reached by tapping your own name was
 * the one that looked like a different product.
 *
 * Four departures from the kit's frame, each because the field behind it does not exist:
 *
 * - **Country and Home Address are not drawn.** `models/userModel.js` has no field for
 *   either. `findByIdAndUpdate` runs in strict mode, so posting them would return 200 and
 *   drop them — a form that reports success and saves nothing.
 * - **The avatar shows initials and does not open a picker.** There is no `profileImage`
 *   on the user model, so an upload would reach Cloudflare (`POST /api/images/upload`
 *   works) and then have nowhere to be stored. The hub already falls back to initials for
 *   the same reason.
 * - **Email is read-only.** Supabase owns the credential; changing it here would move the
 *   LabTrack record away from the address the token is issued against, and the next
 *   `syncAccount()` would link a second account.
 * - **Height and weight are on the form.** The kit puts them in onboarding only, which
 *   means the only way to correct a mistyped height was to walk the 23-screen assessment
 *   again. Weight is drawn in the unit picked in Units & Metrics and converted back to
 *   kilograms on the way out — the record stays metric, per `lib/units.ts`.
 *
 * Saving issues one `PUT /users/:id`. `updateUser` runs without validators (gotcha 10 in
 * CLAUDE.md), so gender is constrained to the enum by the picker here rather than trusted
 * to the server.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, Pressable,
    ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

import { ScreenHeader } from '@/components/settings/ScreenHeader';
import { api, ApiError } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { useUnits, displayWeight, toCanonicalWeight, unitLabel } from '@/lib/units';
import { Palette, Fonts, Spacing, Radius } from '@/constants/theme';
import type { User } from '@/types/api';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** `dob` is stored as a string; the picker needs a Date and tolerates neither empty nor junk. */
const parseDob = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatDob = (date: Date | null): string => (date ? date.toISOString().slice(0, 10) : '');

const initialsOf = (first?: string, last?: string, email?: string) => {
    const letters = `${first ?? ''} ${last ?? ''}`.trim().split(/\s+/).filter(Boolean).map((p) => p[0]);
    if (letters.length) return letters.slice(0, 2).join('').toUpperCase();
    return (email?.[0] ?? '?').toUpperCase();
};

export default function ProfileSettingsScreen() {
    const router = useRouter();
    const units = useUnits();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [gender, setGender] = useState<string | null>(null);
    const [bloodType, setBloodType] = useState<string | null>(null);
    const [dob, setDob] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [heightCm, setHeightCm] = useState('');
    /** Held in the displayed unit while typing; converted to kg on save. */
    const [weightInput, setWeightInput] = useState('');

    const load = useCallback(async () => {
        const userId = await getUserId();
        if (!userId) { router.replace('/(auth)/loginscreen'); return; }
        try {
            const user = await api.get<Partial<User> & { bloodType?: string }>(`/users/${userId}`);
            setEmail(user.email ?? '');
            setFirstName(user.firstName ?? '');
            setLastName(user.lastName ?? '');
            setPhone(user.phone ?? '');
            setGender(user.gender ?? null);
            setBloodType(user.bloodType ?? null);
            setDob(parseDob(user.dob));
            setHeightCm(user.height != null ? String(user.height) : '');
            setWeightInput(user.weight != null ? String(displayWeight(user.weight)) : '');
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
            Toast.show({ type: 'error', text1: 'Could not load your profile' });
        } finally {
            setLoading(false);
        }
    }, [router]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const displayName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

    const save = async () => {
        const userId = await getUserId();
        if (!userId) { router.replace('/(auth)/loginscreen'); return; }

        const height = heightCm.trim() ? Number(heightCm) : null;
        const typedWeight = weightInput.trim() ? Number(weightInput) : null;
        if (height != null && (!Number.isFinite(height) || height < 50 || height > 260)) {
            Toast.show({ type: 'error', text1: 'Check that height', text2: 'Enter a height in centimetres.' });
            return;
        }
        if (typedWeight != null && !Number.isFinite(typedWeight)) {
            Toast.show({ type: 'error', text1: 'Check that weight' });
            return;
        }

        setSaving(true);
        try {
            await api.put(`/users/${userId}`, {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                gender,
                bloodType,
                dob: formatDob(dob),
                height,
                // Back to kilograms before it crosses the API, whatever the form was showing.
                weight: typedWeight != null
                    ? Math.round(toCanonicalWeight(typedWeight, units) * 10) / 10
                    : null,
            });
            Toast.show({ type: 'success', text1: 'Profile saved' });
            router.back();
        } catch (err) {
            if (err instanceof ApiError && err.isAuthError) { router.replace('/(auth)/loginscreen'); return; }
            Toast.show({ type: 'error', text1: 'Could not save', text2: 'Please try again.' });
        } finally {
            setSaving(false);
        }
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
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <ScreenHeader title="Profile Settings" subtitle="Adjust your profile details here" />

                    <View style={styles.avatarWrap}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarInitials}>{initialsOf(firstName, lastName, email)}</Text>
                        </View>
                        {!!displayName && <Text style={styles.avatarName}>{displayName}</Text>}
                    </View>

                    <View style={styles.body}>
                        <Field label="First name">
                            <TextInput
                                style={styles.input}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder="Enter your first name…"
                                placeholderTextColor={Palette.textMuted}
                                autoCapitalize="words"
                            />
                        </Field>

                        <Field label="Last name">
                            <TextInput
                                style={styles.input}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder="Enter your last name…"
                                placeholderTextColor={Palette.textMuted}
                                autoCapitalize="words"
                            />
                        </Field>

                        <Field label="Gender">
                            <Chips options={GENDERS} value={gender} onChange={setGender} />
                        </Field>

                        <Field label="Date of birth">
                            <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
                                <Text style={[styles.inputText, !dob && styles.placeholder]}>
                                    {dob ? formatDob(dob) : 'YYYY / MM / DD'}
                                </Text>
                                <Ionicons name="calendar-outline" size={18} color={Palette.textMuted} />
                            </Pressable>
                        </Field>

                        {showDatePicker && (
                            <DateTimePicker
                                value={dob ?? new Date(1995, 0, 1)}
                                mode="date"
                                maximumDate={new Date()}
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={(_, selected) => {
                                    // Android dismisses itself; iOS keeps the spinner up until Done.
                                    if (Platform.OS !== 'ios') setShowDatePicker(false);
                                    if (selected) setDob(selected);
                                }}
                            />
                        )}
                        {showDatePicker && Platform.OS === 'ios' && (
                            <Pressable style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                                <Text style={styles.pickerDoneText}>Done</Text>
                            </Pressable>
                        )}

                        <Field label="Phone number">
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="+44 000 000 0000"
                                placeholderTextColor={Palette.textMuted}
                                keyboardType="phone-pad"
                            />
                        </Field>

                        {/* Read-only, with the reason on the row rather than in a toast after a
                            failed edit. See the file header. */}
                        <Field label="Email address" hint="Managed by your sign-in — change it where you sign in.">
                            <View style={[styles.input, styles.inputLocked]}>
                                <Ionicons name="mail-outline" size={16} color={Palette.textMuted} />
                                <Text style={[styles.inputText, styles.inputTextLocked]} numberOfLines={1}>
                                    {email || '—'}
                                </Text>
                                <Ionicons name="lock-closed" size={14} color={Palette.textMuted} />
                            </View>
                        </Field>

                        <View style={styles.pair}>
                            <View style={styles.pairItem}>
                                <Field label="Height (cm)">
                                    <TextInput
                                        style={styles.input}
                                        value={heightCm}
                                        onChangeText={setHeightCm}
                                        placeholder="170"
                                        placeholderTextColor={Palette.textMuted}
                                        keyboardType="numeric"
                                    />
                                </Field>
                            </View>
                            <View style={styles.pairItem}>
                                <Field label={`Weight (${unitLabel('weight', units)})`}>
                                    <TextInput
                                        style={styles.input}
                                        value={weightInput}
                                        onChangeText={setWeightInput}
                                        placeholder={units.weight === 'kg' ? '70' : '154'}
                                        placeholderTextColor={Palette.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </Field>
                            </View>
                        </View>

                        <Field label="Blood type">
                            <Chips options={BLOOD_TYPES} value={bloodType} onChange={setBloodType} />
                        </Field>

                        <Pressable
                            style={({ pressed }) => [styles.save, pressed && styles.savePressed, saving && styles.saveBusy]}
                            onPress={save}
                            disabled={saving}
                            accessibilityRole="button"
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color={Palette.white} />
                            ) : (
                                <>
                                    <Text style={styles.saveText}>Save changes</Text>
                                    <Ionicons name="checkmark" size={18} color={Palette.white} />
                                </>
                            )}
                        </Pressable>

                        <Text style={styles.footnote}>
                            Your health answers — conditions, medications, allergies and the rest — live in
                            your health assessment, not here.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const Field = ({
    label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) => (
    <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {children}
        {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
);

/**
 * A wrapping row of choices, used where the kit draws a dropdown.
 *
 * Both lists here are short and fixed, and a native picker on Android is a modal that
 * hides the rest of the form. Tapping the active chip clears it, which is the only way to
 * unset a gender that was picked by mistake.
 */
const Chips = ({
    options, value, onChange,
}: { options: string[]; value: string | null; onChange: (next: string | null) => void }) => (
    <View style={styles.chips}>
        {options.map((option) => {
            const active = value === option;
            return (
                <Pressable
                    key={option}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onChange(active ? null : option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                </Pressable>
            );
        })}
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Palette.background },
    flex: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 64 },

    avatarWrap: { alignItems: 'center', marginTop: Spacing.xl, gap: Spacing.sm },
    avatar: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarInitials: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.primary, includeFontPadding: false },
    avatarName: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },

    body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.lg },

    field: { gap: 6 },
    fieldLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text },
    fieldHint: { fontSize: 11, fontFamily: Fonts.regular, color: Palette.textMuted, lineHeight: 16 },

    input: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        minHeight: 50, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
        borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.xl,
        backgroundColor: Palette.background,
        fontSize: 15, fontFamily: Fonts.regular, color: Palette.text,
    },
    inputLocked: { backgroundColor: Palette.surface },
    inputText: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: Palette.text },
    inputTextLocked: { color: Palette.textSecondary },
    placeholder: { color: Palette.textMuted },

    pair: { flexDirection: 'row', gap: Spacing.md },
    pairItem: { flex: 1 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
        paddingHorizontal: Spacing.lg, paddingVertical: 9,
        borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border,
        backgroundColor: Palette.background,
    },
    chipActive: { backgroundColor: Palette.primarySurface, borderColor: Palette.primary },
    chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Palette.textSecondary },
    chipTextActive: { color: Palette.primaryDark },

    pickerDone: { alignSelf: 'flex-end', marginRight: Spacing.xl },
    pickerDoneText: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.primary, padding: Spacing.sm },

    save: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        backgroundColor: Palette.primary, borderRadius: Radius.xl,
        paddingVertical: 16, marginTop: Spacing.md,
    },
    savePressed: { backgroundColor: Palette.primaryDark },
    saveBusy: { opacity: 0.7 },
    saveText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.white },

    footnote: {
        fontSize: 12, lineHeight: 18, fontFamily: Fonts.regular, color: Palette.textMuted,
        textAlign: 'center', marginTop: Spacing.xs,
    },
});
