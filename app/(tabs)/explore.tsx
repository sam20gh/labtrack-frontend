import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, Button, Avatar } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

const LoginScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setForm({ ...form, [name]: value });
  };

  const handleLogin = async () => {
    setLoading(true);
    const loginData = {
      username: form.username.trim(),
      password: form.password
    };

    try {
      const response = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        if (!data.user || !data.user._id || !data.token) {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Authentication failed' });
          return;
        }

        // ✅ Store user ID and authentication token

        await AsyncStorage.setItem('userId', data.user._id);
        await AsyncStorage.setItem('authToken', data.token);

        console.log('Stored userId:', data.user._id);
        console.log('Stored authToken:', data.token);

        router.replace('/(tabs)/users');
      } else {
        Toast.show({ type: 'error', text1: 'Login Failed', text2: data.message || 'Invalid credentials' });
      }
    } catch (error) {
      setLoading(false);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to the server' });
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.avatarContainer}>
          <Avatar.Icon size={80} icon="account-circle" color="#FF385C" backgroundColor="#FFF5F5" />
        </View>
        <Text style={styles.title}>Login</Text>
        <View style={styles.inputContainer}>
          <Icon name="account" size={20} color="#FF385C" style={styles.icon} />
          <TextInput
            placeholder="Username"
            value={form.username}
            autoCapitalize="none"
            onChangeText={(text) => handleChange('username', text)}
            style={styles.input}
          />
        </View>
        <View style={styles.inputContainer}>
          <Icon name="lock" size={20} color="#FF385C" style={styles.icon} />
          <TextInput
            placeholder="Password"
            value={form.password}
            secureTextEntry
            onChangeText={(text) => handleChange('password', text)}
            style={styles.input}
          />
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#FF385C" />
        ) : (
          <Button mode="contained" style={styles.button} onPress={handleLogin}>
            Login
          </Button>
        )}
      </Card>
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  card: { width: '90%', padding: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
  avatarContainer: { alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#a4a2a2', borderRadius: 5, paddingHorizontal: 10, backgroundColor: '#f9f9f9', marginBottom: 15 },
  input: { flex: 1, paddingVertical: 12 },
  icon: { marginRight: 10 },
  button: { marginTop: 10, backgroundColor: '#FF385C' },
});

export default LoginScreen;
