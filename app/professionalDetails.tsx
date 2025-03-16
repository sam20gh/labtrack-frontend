import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';

const professionalDetails = () => {
    const route = useRoute();
    const { professional } = route.params;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Image source={{ uri: professional.profile_image }} style={styles.image} />
            <Text style={styles.name}>{professional.firstname} {professional.lastname}</Text>
            <Text style={styles.speciality}>{professional.speciality.join(', ')}</Text>
            <Text style={styles.rate}>£{professional.hourly_rate}/hr</Text>
            <Text style={styles.description}>{professional.description}</Text>
            <View style={styles.details}>
                <Text style={styles.detailText}>Address: {professional.address}</Text>
                <Text style={styles.detailText}>Postcode: {professional.postcode}</Text>
                <Text style={styles.detailText}>Country: {professional.country}</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f9f9f9'
    },
    image: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 20,
    },
    name: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    speciality: {
        fontSize: 18,
        color: '#666',
        marginBottom: 10,
    },
    rate: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007bff',
        marginBottom: 10,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: 15,
        marginBottom: 20,
    },
    details: {
        width: '100%',
        paddingHorizontal: 20,
    },
    detailText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 5,
    },
});

export default professionalDetails;
