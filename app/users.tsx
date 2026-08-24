import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TextInput, Platform, TouchableOpacity } from 'react-native';
import { Card, Button, Avatar } from 'react-native-paper';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/types/api';
import { getUserId, signOut } from '@/lib/auth';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const Users = () => {
    const router = useRouter();
    const [userData, setUserData] = useState<(User & { profileImage?: string }) | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
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
                const userId = await getUserId();

                if (!userId) {
                    handleLogout();
                    return;
                }

                let data;
                try {
                    data = await api.get(`/users/${userId}`);
                } catch (err) {
                    if (err instanceof ApiError && err.isAuthError) {
                        handleLogout();
                        return;
                    }
                    throw err;
                }

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
            } catch (error) {
                console.error('Error fetching user:', error);
                handleLogout();
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const handleChange = (name: string, value: string) => {
        setForm({ ...form, [name]: value });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            let data;
            try {
                data = await api.put(`/users/${userData!._id}`, form);
            } catch (err) {
                if (err instanceof ApiError && err.isAuthError) {
                    handleLogout();
                    return;
                }
                throw err;
            }

            setUserData(data);
            setEditing(false);
            Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to connect to the server' });
            handleLogout();
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        await signOut();
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
                            <Avatar.Image size={80} source={{ uri: userData?.profileImage || 'https://i.pravatar.cc/150' }} />
                        </View>

                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.firstName} onChangeText={(text) => handleChange('firstName', text)} editable={editing} placeholder="First Name" />
                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.lastName} onChangeText={(text) => handleChange('lastName', text)} editable={editing} placeholder="Last Name" />
                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.username} onChangeText={(text) => handleChange('username', text)} editable={editing} placeholder="Username" />
                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.email} onChangeText={(text) => handleChange('email', text)} editable={editing} placeholder="Email" />
                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.phone} onChangeText={(text) => handleChange('phone', text)} editable={editing} placeholder="Phone" />

                        {/* Gender Dropdown */}
                        {editing ? (
                            <View style={[styles.input, styles.inputEditable]}>
                                <Picker selectedValue={form.gender} onValueChange={(itemValue) => handleChange('gender', itemValue)}>
                                    <Picker.Item label="Select Gender" value="" />
                                    <Picker.Item label="Male" value="Male" />
                                    <Picker.Item label="Female" value="Female" />
                                </Picker>
                            </View>
                        ) : (
                            <TextInput style={[styles.input, styles.inputDisabled]} value={form.gender} editable={false} placeholder="Gender" />
                        )}

                        {/* DOB Date Picker */}
                        {editing ? (
                            <>
                                <TouchableOpacity style={[styles.input, styles.inputEditable]} onPress={() => setShowDatePicker(true)}>
                                    <Text>{form.dob ? new Date(form.dob).toLocaleDateString() : 'Select Date of Birth'}</Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={form.dob ? new Date(form.dob) : new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (selectedDate) {
                                                handleChange('dob', selectedDate.toISOString());
                                            }
                                        }}
                                    />
                                )}
                            </>
                        ) : (
                            <TextInput style={[styles.input, styles.inputDisabled]} value={form.dob ? new Date(form.dob).toLocaleDateString() : ''} editable={false} placeholder="Date of Birth" />
                        )}

                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.height} onChangeText={(text) => handleChange('height', text)} editable={editing} placeholder="Height" />
                        <TextInput style={[styles.input, editing ? styles.inputEditable : styles.inputDisabled]} value={form.weight} onChangeText={(text) => handleChange('weight', text)} editable={editing} placeholder="Weight" />

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
    profileCard: { padding: 10, marginTop: 10, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
    avatarContainer: { alignItems: 'center', marginBottom: 15 },
    input: { marginBottom: 10, borderWidth: 1, padding: 12, borderRadius: 5 },
    inputEditable: { borderColor: '#ccc', backgroundColor: '#f9f9f9' },
    inputDisabled: { borderColor: '#ddd', backgroundColor: '#e9e9e9' },
    editButton: { marginTop: 10, backgroundColor: '#7C3AED' },
    saveButton: { marginTop: 10, backgroundColor: '#4CAF50' },
    logoutButton: { marginTop: 20, backgroundColor: '#d46176' },
    noResultsText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#666' },
});

export default Users;
