import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Image, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import { useNavigation } from '@react-navigation/native';

interface professional {
    _id: string;
    firstname: string;
    lastname: string;
    speciality: string[];
    hourly_rate: number;
    profile_image: string;
    description: string;
    address: string;
    postcode: string;
    country: string;
}

const professionals = () => {
    const [professionals, setProfessionals] = useState<professional[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    const fetchProfessionals = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/professionals`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            setProfessionals(data);
        } catch (error) {
            console.error('Error fetching professionals:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchProfessionals();
        const interval = setInterval(fetchProfessionals, 5000); // Auto-refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchProfessionals();
    }, []);

    if (loading) {
        return <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={professionals}
                keyExtractor={(item) => item._id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => navigation.navigate('professionalDetails', { professional: item })}>
                        <View style={styles.card}>
                            <Image source={{ uri: item.profile_image }} style={styles.image} />
                            <View style={styles.info}>
                                <Text style={styles.name}>{item.firstname} {item.lastname}</Text>
                                <Text style={styles.speciality}>{item.speciality.join(', ')}</Text>
                                <Text style={styles.rate}>£{item.hourly_rate}/hr</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        backgroundColor: '#f5f5f5'
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
    },
    image: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 15,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    speciality: {
        fontSize: 14,
        color: '#666',
    },
    rate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#007bff',
    },
});

export default professionals;
