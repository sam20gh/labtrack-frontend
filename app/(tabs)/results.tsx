import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config'; // Using centralized API URL
import { useNavigation } from '@react-navigation/native';

const TEST_RESULTS_URL = `${API_URL}/test-results`;

const ResultsPage = () => {
    const [testResults, setTestResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();

    // Fetch test results from API
    useEffect(() => {
        const fetchTestResults = async () => {
            try {
                const response = await fetch(TEST_RESULTS_URL);
                const data = await response.json();

                if (Array.isArray(data) && data.length > 0) {
                    setTestResults(data);
                } else {
                    setTestResults([]);
                }
            } catch (error) {
                console.error('Error fetching test results:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTestResults();
    }, []);

    return (
        <ScrollView style={styles.container}>
            <Title style={styles.pageTitle}>All Test Results</Title>
            {loading ? (
                <ActivityIndicator animating={true} size="large" style={styles.loader} />
            ) : testResults.length > 0 ? (
                testResults.map((test, index) => (
                    <TouchableOpacity key={index} onPress={() => navigation.navigate('TestDetails', { test })}>
                        <Card style={styles.resultCard}>
                            <Card.Content>
                                <Title style={styles.testType}>{test.patient.test_type}</Title>
                                <Paragraph style={styles.labInfo}>Lab: {test.patient.lab_name}</Paragraph>
                                <Paragraph style={styles.testDate}>Date: {test.patient.date_of_test}</Paragraph>
                                <Paragraph style={styles.interpretation}>{test.interpretation}</Paragraph>
                            </Card.Content>
                        </Card>
                    </TouchableOpacity>
                ))
            ) : (
                <Text style={styles.noResultsText}>No test results available</Text>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10, backgroundColor: '#f3f3f3' },
    pageTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 15 },
    loader: { marginVertical: 20 },
    resultCard: { padding: 16, marginBottom: 16, borderRadius: 10, backgroundColor: '#fff', elevation: 3 },
    testType: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    labInfo: { fontSize: 16, color: '#555' },
    testDate: { fontSize: 16, color: '#777' },
    interpretation: { fontSize: 14, fontStyle: 'italic', marginTop: 5 },
    noResultsText: { textAlign: 'center', fontSize: 16, color: '#666', marginVertical: 20 },
});

export default ResultsPage;
