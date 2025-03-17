import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const RegisterScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    dob: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setForm({ ...form, [name]: value });
  };

  const handleSignup = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/users/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        await AsyncStorage.setItem('userId', data.user._id);
        await AsyncStorage.setItem('authToken', data.token || '');
        Alert.alert('Success', 'User registered successfully!');
        router.replace('/(tabs)/users');
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Signup failed' });
      }
    } catch (error) {
      setLoading(false);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to the server' });
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>Register</Text>

        <TextInput placeholder="First Name" value={form.firstName} onChangeText={(text) => handleChange('firstName', text)} style={styles.input} />
        <TextInput placeholder="Last Name" value={form.lastName} onChangeText={(text) => handleChange('lastName', text)} style={styles.input} />
        <TextInput placeholder="Username" value={form.username} onChangeText={(text) => handleChange('username', text)} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Email" value={form.email} keyboardType="email-address" onChangeText={(text) => handleChange('email', text)} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(text) => handleChange('phone', text)} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Date of Birth (YYYY-MM-DD)" value={form.dob} onChangeText={(text) => handleChange('dob', text)} style={styles.input} />
        <TextInput placeholder="Password" value={form.password} secureTextEntry onChangeText={(text) => handleChange('password', text)} style={styles.input} autoCapitalize="none" />

        {loading ? (
          <ActivityIndicator size="large" color="#FF385C" />
        ) : (
          <Button mode="contained" style={styles.button} onPress={handleSignup}>
            <Text>Sign Up</Text>
          </Button>
        )}

        <TouchableOpacity onPress={() => router.push('/(auth)/loginscreen')} style={styles.loginLink}>
          <Text style={styles.loginText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </Card>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  card: { width: '90%', padding: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { marginBottom: 10, borderWidth: 1, padding: 12, borderRadius: 5 },
  button: { marginTop: 10, backgroundColor: '#FF385C' },
  loginLink: { marginTop: 15, alignItems: 'center' },
  loginText: { color: '#FF385C', textDecorationLine: 'underline' },
});

export default RegisterScreen;
