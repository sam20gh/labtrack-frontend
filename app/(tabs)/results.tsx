import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config'; // Using centralized API URL
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
            <Title style={styles.pageTitle}>🧪 All Test Results</Title>
            {loading ? (
                <ActivityIndicator animating={true} size="large" style={styles.loader} />
            ) : testResults.length > 0 ? (
                testResults.map((test, index) => (
                    <TouchableOpacity key={index} onPress={() => navigation.navigate('TestDetails', { test })}>
                        <Card style={styles.resultCard}>
                            <Card.Content>
                                <View style={styles.headerRow}>
                                    <Icon name="flask-outline" size={24} color="#6200ea" />
                                    <Title style={styles.testType}>{test.patient.test_type}</Title>
                                </View>
                                <Paragraph style={styles.labInfo}><Icon name="hospital" size={18} color="#666" /> Lab: {test.patient.lab_name}</Paragraph>
                                <Paragraph style={styles.testDate}><Icon name="calendar" size={18} color="#666" /> Date: {test.patient.date_of_test}</Paragraph>
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
    container: { flex: 1, padding: 10, backgroundColor: '#f9f9f9' },
    pageTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 15, color: '#6200ea' },
    loader: { marginVertical: 20 },
    resultCard: { padding: 20, marginBottom: 16, borderRadius: 12, backgroundColor: '#fff', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    testType: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#333' },
    labInfo: { fontSize: 16, color: '#555', marginVertical: 3 },
    testDate: { fontSize: 16, color: '#777', marginVertical: 3 },
    interpretation: { fontSize: 14, fontStyle: 'italic', marginTop: 5, color: '#333' },
    noResultsText: { textAlign: 'center', fontSize: 16, color: '#666', marginVertical: 20 },
});

export default ResultsPage;
