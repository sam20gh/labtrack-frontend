import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Appbar, Avatar, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Users = ({ navigation }: any) => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                console.log('Retrieved User ID from AsyncStorage:', userId);

                if (!userId || userId === 'undefined') {
                    console.warn('No valid user ID found in storage.');
                    return;
                }

                // ✅ Add cache-busting technique
                const response = await fetch(`${API_URL}/users/${userId}?timestamp=${new Date().getTime()}`);
                const data = await response.json();

                console.log('Fetched User Data:', data);

                if (response.ok && data) {
                    setUserData(data);
                } else {
                    console.warn('Failed to fetch user:', data.message);
                    setUserData(null);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);





    return (
        <LinearGradient colors={['#0097b2', '#307313']} style={styles.container}>
            <ScrollView style={styles.container}>
                {loading ? (
                    <ActivityIndicator animating={true} size="large" style={styles.loader} />
                ) : userData ? (
                    <Card style={styles.profileCard}>
                        <Card.Content>
                            <View style={styles.avatarContainer}>
                                <Avatar.Image size={80} source={{ uri: userData.avatar || 'https://i.pravatar.cc/150' }} />
                            </View>
                            <Title style={styles.userName}>{userData.firstName} {userData.lastName}</Title>
                            <Paragraph style={styles.userEmail}>Email: {userData.email}</Paragraph>
                            <Paragraph style={styles.userPhone}>Phone: {userData.phone}</Paragraph>
                        </Card.Content>
                    </Card>
                ) : (
                    <Text style={styles.noResultsText}>No user data found</Text>
                )}
            </ScrollView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: 'transparent' },
    loader: { marginVertical: 20 },
    profileCard: { padding: 20, marginTop: 20, borderRadius: 10, backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    avatarContainer: { alignItems: 'center', marginBottom: 15 },
    userName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#333' },
    userEmail: { fontSize: 16, textAlign: 'center', color: '#666' },
    userPhone: { fontSize: 16, textAlign: 'center', color: '#666' },
    noResultsText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: 'white' },
});

export default Users;
