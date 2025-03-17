import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { Card, Button, Avatar } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

const Users = () => {
    const router = useRouter();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        phone: '',
        dob: '',
        gender: '',
        height: '',
        weight: ''
    });

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                const token = await AsyncStorage.getItem('authToken');

                if (!userId || !token) {
                    handleLogout();
                    return;
                }

                const response = await fetch(`${API_URL}/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json();

                if (response.status === 401 || response.status === 403) {
                    handleLogout();
                    return;
                }

                if (response.ok) {
                    setUserData(data);
                    setForm({
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        username: data.username || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        dob: data.dob || '',
                        gender: data.gender || '',
                        height: data.height ? String(data.height) : '',
                        weight: data.weight ? String(data.weight) : ''
                    });
                } else {
                    Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Failed to fetch user data' });
                }
            } catch (error) {
                console.error('Error fetching user:', error);
                handleLogout();
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const handleChange = (name, value) => {
        setForm({ ...form, [name]: value });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                handleLogout();
                return;
            }

            const response = await fetch(`${API_URL}/users/${userData._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(form),
            });

            const data = await response.json();

            if (response.status === 401 || response.status === 403) {
                handleLogout();
                return;
            }

            if (response.ok) {
                setUserData(data);
                setEditing(false);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
            } else {
                Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Update failed' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to the server' });
            handleLogout();
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userId');
        await AsyncStorage.removeItem('authToken');
        Toast.show({ type: 'info', text1: 'Logged out', text2: 'Your session has expired. Please log in again.' });
        router.replace('/(auth)/loginscreen');
    };

    return (
        <ScrollView style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
            ) : userData ? (
                <Card style={styles.profileCard}>
                    <Card.Content>
                        <View style={styles.avatarContainer}>
                            <Avatar.Image size={80} source={{ uri: userData.profileImage || 'https://i.pravatar.cc/150' }} />
                        </View>
                        {Object.keys(form).map((key) => (
                            <TextInput
                                key={key}
                                style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]}
                                value={form[key]}
                                onChangeText={(text) => handleChange(key, text)}
                                editable={editing}
                                placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                            />
                        ))}
                        {editing ? (
                            <Button mode="contained" style={styles.saveButton} onPress={handleSave}>
                                <Text>Save</Text>
                            </Button>
                        ) : (
                            <Button mode="contained" style={styles.editButton} onPress={() => setEditing(!editing)}>
                                <Text>Edit Profile</Text>
                            </Button>
                        )}
                        <Button mode="contained" style={styles.logoutButton} onPress={handleLogout}>
                            <Text>Logout</Text>
                        </Button>
                    </Card.Content>
                </Card>
            ) : (
                <Text style={styles.noResultsText}>No user data found</Text>
            )}
            <Toast />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    loader: { marginVertical: 20 },
    profileCard: { padding: 20, marginTop: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
    avatarContainer: { alignItems: 'center', marginBottom: 15 },
    input: { marginBottom: 10, borderWidth: 1, padding: 12, borderRadius: 5 },
    inputEditable: { borderColor: '#ccc', backgroundColor: '#f9f9f9' },
    inputDisabled: { borderColor: '#ddd', backgroundColor: '#e9e9e9' },
    editButton: { marginTop: 10, backgroundColor: '#FF385C' },
    saveButton: { marginTop: 10, backgroundColor: '#4CAF50' },
    logoutButton: { marginTop: 20, backgroundColor: '#FF385C' },
    noResultsText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
});

export default Users;
