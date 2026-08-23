import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { api, ApiError } from '@/lib/api';
import type { NavigationProp } from '@react-navigation/native';
import type { TestResult } from '@/types/api';

type AppNavigation = NavigationProp<Record<string, object | undefined>>;
import { getUserId } from '@/lib/auth';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const ResultsPage = () => {
    const [testResults, setTestResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigation = useNavigation<AppNavigation>();

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            const fetchTestResults = async () => {
                const userId = await getUserId();
                if (!userId) { setLoading(false); return; }

                try {
                    // Server returns newest-first; empty history is a 200 with []
                    const data = await api.get(`/test-results?user_id=${userId}`);
                    setTestResults(Array.isArray(data) ? data : []);
                } catch (error) {
                    const message = error instanceof ApiError ? error.message : 'Failed to fetch test results';
                    Toast.show({ type: 'error', text1: 'Error', text2: message });
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
            <Toast />
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
