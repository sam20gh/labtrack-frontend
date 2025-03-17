import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Card, Button } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            setLoading(false);

            if (response.ok) {
                if (!data.user || !data.user._id || !data.token) {
                    Toast.show({ type: 'error', text1: 'Error', text2: 'Authentication failed' });
                    return;
                }

                await AsyncStorage.setItem('userId', data.user._id);
                await AsyncStorage.setItem('authToken', data.token);

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
                <Text style={styles.title}>Login</Text>
                <TextInput
                    placeholder="Username"
                    value={form.username}
                    autoCapitalize="none"
                    onChangeText={(text) => handleChange('username', text)}
                    style={styles.input}
                />
                <TextInput
                    placeholder="Password"
                    value={form.password}
                    autoCapitalize="none"
                    secureTextEntry
                    onChangeText={(text) => handleChange('password', text)}
                    style={styles.input}
                />
                {loading ? (
                    <ActivityIndicator size="large" color="#FF385C" />
                ) : (
                    <Button mode="contained" style={styles.button} onPress={handleLogin}>
                        <Text>Login</Text>
                    </Button>
                )}
                <TouchableOpacity onPress={() => router.push('/(tabs)/signup')} style={styles.registerLink}>
                    <Text style={styles.registerText}>Don't have an account? Register</Text>
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
    registerLink: { marginTop: 15, alignItems: 'center' },
    registerText: { color: '#FF385C', textDecorationLine: 'underline' },
});

export default LoginScreen;
