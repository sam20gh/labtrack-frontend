import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Appbar, Avatar, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';

const API_URL = 'http://192.168.1.105:5002/api/user'; // Replace with actual backend URL

const UserScreen = ({ navigation }: any) => {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await fetch(API_URL);
                const data = await response.json();
                setUserData(data);
            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    return (
        <ScrollView style={styles.container}>
            <Appbar.Header style={styles.appBar}>
                <Appbar.Content title="User Profile" />
                <Appbar.Action icon="home" onPress={() => navigation.navigate('Home')} />
            </Appbar.Header>

            {loading ? (
                <ActivityIndicator animating={true} size="large" style={styles.loader} />
            ) : (
                <Card style={styles.profileCard}>
                    <Card.Content>
                        <View style={styles.avatarContainer}>
                            <Avatar.Image size={80} source={{ uri: userData?.avatar }} />
                        </View>
                        <Title style={styles.userName}>{userData?.name}</Title>
                        <Paragraph style={styles.userEmail}>{userData?.email}</Paragraph>
                        <Paragraph style={styles.userPhone}>{userData?.phone}</Paragraph>
                    </Card.Content>
                </Card>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f9f9f9' },
    appBar: { backgroundColor: '#fff' },
    loader: { marginVertical: 20 },
    profileCard: { padding: 20, marginTop: 20, borderRadius: 10, backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    avatarContainer: { alignItems: 'center', marginBottom: 15 },
    userName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#333' },
    userEmail: { fontSize: 16, textAlign: 'center', color: '#666' },
    userPhone: { fontSize: 16, textAlign: 'center', color: '#666' },
});

export default UserScreen;
