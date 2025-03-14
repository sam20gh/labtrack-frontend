import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ResultsPage = () => {
    const [testResults, setTestResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation();

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            const fetchTestResults = async () => {
                try {
                    const userId = await AsyncStorage.getItem('userId');
                    if (!userId) {
                        console.error('User ID not found');
                        setLoading(false);
                        return;
                    }
                    const response = await fetch(`${API_URL}/test-results?user_id=${userId}`);
                    const data = await response.json();

                    if (data) {
                        let resultsArray = Array.isArray(data) ? data : [data];
                        // Sort the results by date_of_test (latest first)
                        resultsArray.sort(
                            (a, b) =>
                                new Date(b.patient.date_of_test).getTime() -
                                new Date(a.patient.date_of_test).getTime()
                        );
                        setTestResults(resultsArray);
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
        }, [])
    );

    return (
        <ScrollView style={styles.container}>
            <Title style={styles.pageTitle}>🧪 Your Test Results</Title>
            {loading ? (
                <ActivityIndicator animating={true} size="large" style={styles.loader} />
            ) : testResults.length > 0 ? (
                testResults.map((test, index) => (
                    <TouchableOpacity key={index} onPress={() => navigation.navigate('TestDetails', { test })}>
                        <Card style={styles.resultCard}>
                            <Card.Content>
                                <View style={styles.headerRow}>
                                    <Icon name="hospital" size={24} color="#FF385C" />
                                    <Title style={styles.testType}>{test?.patient?.lab_name ?? 'Unknown Lab'}</Title>
                                </View>
                                <Paragraph style={styles.testDate}>
                                    <Icon name="calendar" size={18} color="#666" /> Date: {test?.patient?.date_of_test ?? 'Unknown Date'}
                                </Paragraph>
                                <Paragraph style={styles.interpretation}>
                                    {test?.interpretation ?? 'No interpretation available'}
                                </Paragraph>
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
    pageTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 15, color: '#FF385C' },
    loader: { marginVertical: 20 },
    resultCard: { padding: 20, marginBottom: 16, borderRadius: 12, backgroundColor: '#fff', elevation: 5 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    testType: { fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#333' },
    testDate: { fontSize: 16, color: '#777', marginVertical: 3 },
    interpretation: { fontSize: 14, fontStyle: 'italic', marginTop: 5, color: '#333' },
    noResultsText: { textAlign: 'center', fontSize: 16, color: '#666', marginVertical: 20 },
});

export default ResultsPage;
