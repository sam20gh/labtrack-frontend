import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Appbar, Avatar, Card, Title, Paragraph, ActivityIndicator, Button } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

const Users = () => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', dob: '' });
    const router = useRouter();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                const token = await AsyncStorage.getItem('authToken');

                if (!userId || !token) {
                    Toast.show({ type: 'error', text1: 'Error', text2: 'Unauthorized. Please log in again.' });
                    router.replace('/loginscreen');
                    return;
                }

                console.log('Fetching data for userId:', userId);

                const response = await fetch(`${API_URL}/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json();
                if (response.ok && data) {
                    console.log('Fetched user data:', data);
                    setUserData(data);
                    setForm({
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        username: data.username || '',
                        email: data.email || '',
                        dob: data.dob || '',
                    });
                } else {
                    Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Failed to fetch user data' });
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            } finally {
                setLoading(false);
            }
        };


        fetchUserData();
    }, []);

    const handleEditToggle = () => setEditing(!editing);

    const handleChange = (name, value) => {
        setForm({ ...form, [name]: value });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken'); // Retrieve token
            if (!token) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Unauthorized. Please log in again.' });
                router.replace('/loginscreen');
                return;
            }

            console.log('Sending Token:', token); // ✅ Debugging: Log token before sending

            const response = await fetch(`${API_URL}/users/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Ensure correct format
                },
                body: JSON.stringify(form),
            });

            const data = await response.json();
            if (response.ok) {
                setUserData(data);
                setEditing(false);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
            } else {
                Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Update failed' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to the server' });
        }
        setLoading(false);
    };


    return (
        <ScrollView style={styles.container}>
            {loading ? (
                <ActivityIndicator animating={true} size="large" style={styles.loader} />
            ) : userData ? (
                <Card style={styles.profileCard}>
                    <Card.Content>
                        <View style={styles.avatarContainer}>
                            <Avatar.Image size={80} source={{ uri: userData.avatar || 'https://i.pravatar.cc/150' }} />
                        </View>
                        <TextInput
                            style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]}
                            value={form.firstName}
                            onChangeText={(text) => handleChange('firstName', text)}
                            editable={editing}
                            placeholder="First Name"
                        />
                        <TextInput
                            style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]}
                            value={form.lastName}
                            onChangeText={(text) => handleChange('lastName', text)}
                            editable={editing}
                            placeholder="Last Name"
                        />
                        <TextInput
                            style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]}
                            value={form.username}
                            onChangeText={(text) => handleChange('username', text)}
                            editable={editing}
                            placeholder="Username"
                        />
                        <TextInput
                            style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]}
                            value={form.email}
                            onChangeText={(text) => handleChange('email', text)}
                            editable={editing}
                            placeholder="Email"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]}
                            value={form.dob}
                            onChangeText={(text) => handleChange('dob', text)}
                            editable={editing}
                            placeholder="Date of Birth"
                        />
                        {editing ? (
                            <Button mode="contained" style={styles.saveButton} onPress={handleSave}>Save</Button>
                        ) : (
                            <Button mode="contained" style={styles.editButton} onPress={handleEditToggle}>Edit Profile</Button>
                        )}
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
    noResultsText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
});

export default Users;
