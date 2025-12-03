import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

const RegisterScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    dob: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
  };

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const password = form.password;
    if (!password) return { level: 0, text: '', color: '#E5E7EB' };

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 1) return { level: 1, text: 'Weak! Add Strength!', color: '#EF4444', emoji: '💪' };
    if (strength <= 2) return { level: 2, text: 'Fair', color: '#F59E0B', emoji: '👍' };
    if (strength <= 3) return { level: 3, text: 'Good', color: '#10B981', emoji: '✨' };
    return { level: 4, text: 'Amazing!', color: '#7C3AED', emoji: '🎉' };
  }, [form.password]);

  const passwordsMatch = form.password && form.confirmPassword && form.password === form.confirmPassword;

  const handleSignup = async () => {
    if (!form.email || !form.password || !form.confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill in all required fields' });
      return;
    }

    if (form.password !== form.confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Passwords do not match' });
      return;
    }

    if (passwordStrength.level < 2) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please choose a stronger password' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        await AsyncStorage.setItem('userId', data.user._id);
        await AsyncStorage.setItem('authToken', data.token || '');
        Toast.show({ type: 'success', text1: 'Success', text2: 'Account created successfully!' });
        router.replace('/(tabs)/ProfileScreen');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Signup failed' });
      }
    } catch (error) {
      setLoading(false);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to the server' });
    }
  };

  const isFormValid = form.email && form.password && form.confirmPassword && passwordsMatch && passwordStrength.level >= 2;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="add" size={32} color="#7C3AED" />
            </View>
            <Text style={styles.logoText}>LabTrack</Text>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>Let's sign up to get intelligent health.</Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="elementary221b@gmail.com"
                placeholderTextColor="#9CA3AF"
                value={form.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(text) => handleChange('email', text)}
                style={styles.input}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder="••••"
                placeholderTextColor="#9CA3AF"
                value={form.password}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
                onChangeText={(text) => handleChange('password', text)}
                style={[styles.input, styles.passwordInput]}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {/* Password Strength Indicator */}
            {form.password ? (
              <View style={styles.strengthContainer}>
                <Text style={styles.strengthLabel}>Password strength: </Text>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.text} {passwordStrength.emoji}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputContainer, passwordsMatch && styles.inputContainerSuccess]}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder="••••••••••••••"
                placeholderTextColor="#9CA3AF"
                value={form.confirmPassword}
                autoCapitalize="none"
                secureTextEntry={!showConfirmPassword}
                onChangeText={(text) => handleChange('confirmPassword', text)}
                style={[styles.input, styles.passwordInput]}
              />
              {passwordsMatch ? (
                <View style={styles.checkIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpButton, !isFormValid && styles.signUpButtonDisabled]}
            onPress={handleSignup}
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.signUpButtonText}>Sign Up</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>I already have </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/loginscreen')}>
              <Text style={styles.loginLink}>an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#7C3AED',
  },
  tagline: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  inputContainerSuccess: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  passwordInput: {
    paddingLeft: 8,
  },
  eyeIcon: {
    padding: 16,
  },
  checkIcon: {
    padding: 16,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signUpButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
  },
  signUpButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  loginText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#7C3AED',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen;
