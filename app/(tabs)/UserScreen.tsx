import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Appbar, Button, Card, Title, Paragraph, ActivityIndicator, Divider } from 'react-native-paper';

const API_URL = 'http://192.168.1.105:5002/api/test-results'; // Replace with actual backend URL

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
            <Appbar.Header style={styles.appBar}>
                <Appbar.Content title="LabTrack" />
                <Appbar.Action icon="account-circle" onPress={() => navigation.navigate('Profile')} />
            </Appbar.Header>

            <View style={styles.heroSection}>
                <Title style={styles.heroTitle}>Welcome to LabTrack</Title>
                <Paragraph style={styles.heroSubtitle}>Your health, simplified.</Paragraph>
                <Button mode="contained" onPress={() => navigation.navigate('Tests')} style={styles.orderButton} labelStyle={styles.orderButtonText}>
                    Order a Test
                </Button>
            </View>

            <Title style={styles.sectionTitle}>Recent Test Results</Title>
            {loading ? (
                <ActivityIndicator animating={true} size="large" style={styles.loader} />
            ) : (
                <Card style={styles.resultCard}>
                    <Card.Content>
                        {testResults.map((result: any, index: number) => (
                            <View key={result.id} style={[styles.resultRow]}>
                                <View style={[styles.statusIndicator, getStatusColor(result.status)]} />
                                <View style={styles.resultTextContainer}>
                                    <Title style={styles.resultText}>{result.testName}</Title>
                                    <Paragraph style={styles.resultStatus}>{result.status}</Paragraph>
                                </View>
                            </View>
                        ))}
                    </Card.Content>
                </Card>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f9f9f9' },
    appBar: { backgroundColor: '#fff' },
    heroSection: { alignItems: 'center', marginBottom: 20, padding: 20, backgroundColor: '#6200ea', borderRadius: 10 },
    heroTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    orderButtonText: { color: '#6200ea' },
    heroSubtitle: { fontSize: 16, color: '#e0e0e0', marginBottom: 10 },
    orderButton: { marginTop: 10, backgroundColor: 'white', color: '#6200ea' },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, color: '#333' },
    loader: { marginVertical: 20 },
    resultCard: { padding: 16, marginBottom: 16, borderRadius: 10, backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    resultRow: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 5, borderRadius: 5, backgroundColor: '#f5f5f5', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
    resultTextContainer: { flex: 1 },
    resultText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    resultStatus: { fontSize: 14, color: '#666' },
    normal: { backgroundColor: 'green' },
    high: { backgroundColor: 'red' },
    pending: { backgroundColor: 'yellow' },
    default: { backgroundColor: 'gray' }
});

export default HomeScreen;
