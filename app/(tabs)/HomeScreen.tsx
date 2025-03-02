import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Appbar, Button, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';

const API_URL = 'http://192.168.1.100:5002/api/test-results'; // Replace with actual backend URL

const HomeScreen = ({ navigation }: any) => {
    const [testResults, setTestResults] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch test results from API
    useEffect(() => {
        const fetchTestResults = async () => {
            try {
                const response = await fetch(API_URL);
                const data = await response.json();
                setTestResults(data);
            } catch (error) {
                console.error('Error fetching test results:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTestResults();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'normal': return styles.normal;
            case 'high': return styles.high;
            case 'pending': return styles.pending;
            default: return styles.default;
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Appbar.Header>
                <Appbar.Content title="LabTrack" />
                <Appbar.Action icon="account-circle" onPress={() => navigation.navigate('Profile')} />
            </Appbar.Header>

            <View style={styles.heroSection}>
                <Title style={styles.heroTitle}>Welcome to LabTrack</Title>
                <Paragraph style={styles.heroSubtitle}>Your health, simplified.</Paragraph>
                <Button mode="contained" onPress={() => navigation.navigate('Tests')}>Order a Test</Button>
            </View>

            <Title style={styles.sectionTitle}>Recent Test Results</Title>
            {loading ? (
                <ActivityIndicator animating={true} size="large" />
            ) : (
                testResults.map((result: any) => (
                    <Card key={result.id} style={[styles.resultCard, getStatusColor(result.status)]}>
                        <Card.Content>
                            <Title>{result.testName}</Title>
                            <Paragraph>Status: {result.status}</Paragraph>
                        </Card.Content>
                    </Card>
                ))
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    heroSection: { alignItems: 'center', marginBottom: 20 },
    heroTitle: { fontSize: 24, fontWeight: 'bold' },
    heroSubtitle: { fontSize: 16, color: 'gray', marginBottom: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
    resultCard: { marginBottom: 10 },
    normal: { backgroundColor: 'lightgreen' },
    high: { backgroundColor: 'lightcoral' },
    pending: { backgroundColor: 'lightyellow' },
    default: { backgroundColor: 'white' }
});

export default HomeScreen;
