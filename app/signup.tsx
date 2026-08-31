/**
 * Sign up. The third and fourth frames of `Design/auth.png`.
 *
 * Two things the design encodes and the code has to keep:
 *
 * 1. **The primary action is disabled until the form is actually valid**, and the disabled
 *    state is a pale lavender with lavender text — a button that reads as "not yet",
 *    not as "broken". Grey would have said the control was unavailable rather than waiting.
 * 2. **The strength meter never gates on a promise it cannot keep.** It grades composition
 *    only; see `lib/password.ts`.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AuthErrorBanner from '@/components/auth/AuthErrorBanner';
import AuthField from '@/components/auth/AuthField';
import AuthHeader from '@/components/auth/AuthHeader';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { authStyles } from '@/components/auth/styles';
import { Fonts, Palette } from '@/constants/theme';
import { signUpWithEmail } from '@/lib/auth';
import { MIN_ACCEPTED_LEVEL, scorePassword } from '@/lib/password';

const RegisterScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (name: 'email' | 'password' | 'confirmPassword', value: string) => {
    setForm({ ...form, [name]: value });
    setError('');
  };

  const strength = useMemo(() => scorePassword(form.password), [form.password]);

  const passwordsMatch = Boolean(
    form.password && form.confirmPassword && form.password === form.confirmPassword
  );
  const confirmMismatch = Boolean(form.confirmPassword) && !passwordsMatch;

  const isFormValid = Boolean(
    form.email && passwordsMatch && strength.level >= MIN_ACCEPTED_LEVEL
  );

  const handleSignup = async () => {
    if (!isFormValid) {
      setError(
        !form.email
          ? 'Please enter your email address'
          : strength.level < MIN_ACCEPTED_LEVEL
            ? 'Please choose a stronger password'
            : 'Passwords do not match'
      );
      return;
    }

    setLoading(true);
    setError('');
    const result = await signUpWithEmail(form.email, form.password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error || 'Signup failed');
      return;
    }

    // This project requires email confirmation, so signUp returns no session. Showing the
    // app here would produce an account that 403s on every request until the link is
    // clicked, so surface the confirmation step instead.
    if (result.needsConfirmation) {
      setAwaitingConfirmation(true);
      return;
    }

    Toast.show({ type: 'success', text1: 'Success', text2: 'Account created successfully!' });
    router.replace('/(tabs)');
  };

  if (awaitingConfirmation) {
    return (
      <SafeAreaView style={authStyles.screen} edges={['top', 'bottom']}>
        <View style={confirmStyles.wrap}>
          <View style={confirmStyles.iconCircle}>
            <Ionicons name="mail-outline" size={40} color={Palette.primary} />
          </View>
          <Text style={confirmStyles.title}>Check your email</Text>
          <Text style={confirmStyles.body}>
            We&apos;ve sent a confirmation link to{'\n'}
            <Text style={confirmStyles.email}>{form.email}</Text>
          </Text>
          <Text style={confirmStyles.hint}>
            Tap the link to activate your account, then sign in. The link expires after 24 hours.
          </Text>

          <TouchableOpacity
            style={[authStyles.primaryButton, confirmStyles.fullWidth]}
            onPress={() => router.replace('/(auth)/loginscreen')}
            accessibilityRole="button"
          >
            <Text style={authStyles.primaryButtonText}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              const retry = await signUpWithEmail(form.email, form.password);
              Toast.show(
                retry.ok
                  ? { type: 'success', text1: 'Sent', text2: 'Confirmation email resent' }
                  : { type: 'error', text1: 'Error', text2: retry.error || 'Could not resend' }
              );
            }}
          >
            <Text style={confirmStyles.resend}>Didn&apos;t get it? Resend email</Text>
          </TouchableOpacity>
        </View>
        <Toast />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={authStyles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={authStyles.flex}
      >
        <ScrollView
          contentContainerStyle={authStyles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.bannerSlot}>
              <AuthErrorBanner message={error} onDismiss={() => setError('')} />
            </View>
          ) : null}

          <AuthHeader tagline="Let's sign up to get intelligent health." />

          <View style={styles.form}>
            <AuthField
              label="Email Address"
              icon="mail-outline"
              placeholder="Enter your email address..."
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <View style={styles.passwordGroup}>
              <AuthField
                label="Password"
                icon="lock-closed-outline"
                placeholder="Create a password"
                value={form.password}
                onChangeText={(text) => handleChange('password', text)}
                autoCapitalize="none"
                autoComplete="new-password"
                secureTextEntry={!showPassword}
                attached
                accessory={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={Palette.textSecondary}
                    />
                  </TouchableOpacity>
                }
              />
              <PasswordStrength strength={strength} />
            </View>

            <AuthField
              label="Confirm Password"
              icon="lock-closed-outline"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChangeText={(text) => handleChange('confirmPassword', text)}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry={!showConfirmPassword}
              invalid={confirmMismatch}
              returnKeyType="go"
              onSubmitEditing={handleSignup}
              accessory={
                passwordsMatch ? (
                  <Ionicons name="checkmark-circle" size={20} color={Palette.meterStrong} />
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={Palette.textSecondary}
                    />
                  </TouchableOpacity>
                )
              }
            />

            <TouchableOpacity
              style={[
                authStyles.primaryButton,
                styles.submit,
                !isFormValid && authStyles.primaryButtonDisabled,
              ]}
              onPress={handleSignup}
              disabled={loading || !isFormValid}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isFormValid }}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Palette.white} />
              ) : (
                <>
                  <Text
                    style={[
                      authStyles.primaryButtonText,
                      !isFormValid && authStyles.primaryButtonTextDisabled,
                    ]}
                  >
                    Sign Up
                  </Text>
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={isFormValid ? Palette.white : Palette.primaryLight}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={authStyles.footer}>
            <Text style={authStyles.footerText}>I already have </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/loginscreen')} hitSlop={8}>
              <Text style={authStyles.footerLink}>an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bannerSlot: {
    marginBottom: 16,
  },
  form: {
    marginTop: 44,
  },
  passwordGroup: {
    marginBottom: 23,
  },
  submit: {
    marginTop: 12,
  },
});

const confirmStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Palette.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text, marginBottom: 12 },
  body: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  email: { fontFamily: Fonts.semibold, color: Palette.text },
  hint: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  fullWidth: { alignSelf: 'stretch', marginBottom: 20 },
  resend: { color: Palette.primary, fontSize: 14, fontFamily: Fonts.semibold },
});

export default RegisterScreen;
