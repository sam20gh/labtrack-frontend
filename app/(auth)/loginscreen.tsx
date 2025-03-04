import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Card, Button as UIButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router'; // Import navigation
import AsyncStorage from '@react-native-async-storage/async-storage';

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

        console.log('Sending Login Data:', JSON.stringify(loginData, null, 2));

        try {
            const response = await fetch(`${API_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
            });

            const data = await response.json();
            console.log('Full Server Response:', data);
            setLoading(false);

            if (response.ok) {
                console.log('User Object Received:', data.user);

                if (!data.user || !data.user._id) {
                    console.error('User ID is missing in response!');
                    Alert.alert('Error', 'User ID is missing. Please try again.');
                    return;
                }

                // ✅ Clear old user ID before storing new one
                await AsyncStorage.removeItem('userId');
                await AsyncStorage.setItem('userId', data.user._id);

                const storedUserId = await AsyncStorage.getItem('userId');
                console.log('Stored User ID in AsyncStorage:', storedUserId);

                router.replace('/users'); // ✅ Redirect after storing user ID
            } else {
                console.warn('Login Failed:', data.message);
                Alert.alert('Error', data.message || 'Invalid credentials');
            }
        } catch (error) {
            setLoading(false);
            console.error('Login Error:', error);
            Alert.alert('Error', 'Failed to connect to the server');
        }
    };

    return (
        <LinearGradient colors={['#0097b2', '#307313']} style={styles.container}>
            <View style={styles.innerContainer}>
                <Card style={styles.card}>
                    <Text style={styles.title}>Login</Text>
                    <TextInput
                        placeholder="Username"
                        value={form.username}
                        onChangeText={(text) => handleChange('username', text)}
                        style={styles.input}
                    />
                    <TextInput
                        placeholder="Password"
                        value={form.password}
                        secureTextEntry
                        onChangeText={(text) => handleChange('password', text)}
                        style={styles.input}
                    />

                    {loading ? (
                        <ActivityIndicator size="large" color="#307313" />
                    ) : (
                        <UIButton mode="contained" style={styles.button} onPress={handleLogin}>
                            Login
                        </UIButton>
                    )}
                </Card>

            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
    innerContainer: { padding: 20, flex: 1, justifyContent: 'center' },
    card: { padding: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#333' },
    input: { marginBottom: 10, borderWidth: 1, padding: 12, borderRadius: 5, borderColor: '#ccc', backgroundColor: '#f9f9f9' },
    button: { marginTop: 20, paddingVertical: 10 },
});

export default LoginScreen;
