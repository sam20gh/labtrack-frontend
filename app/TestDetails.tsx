import React from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';

interface TestDetailsProps {
    patient: {
        user_id: string;
        name: string;
        age: number;
        gender: string;
        date_of_test: string;
        lab_name: string;
        test_type: string;
    };
    results: {
        [key: string]: {
            value: number;
            unit: string;
            reference_range: string;
            status: string;
        };
    };
    interpretation: string;
}

const TestDetails: React.FC = () => {
    const route = useRoute();
    console.log('Route params:', route.params);
    const test = route.params?.test as TestDetailsProps | undefined;

    if (!test) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>No test details available.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Card style={styles.card}>
                <Card.Content>
                    <Title style={styles.testType}>{test.patient.test_type}</Title>
                    <Paragraph style={styles.labInfo}>Lab: {test.patient.lab_name}</Paragraph>
                    <Paragraph style={styles.testDate}>Date: {test.patient.date_of_test}</Paragraph>
                    <Paragraph style={styles.interpretation}>{test.interpretation}</Paragraph>
                </Card.Content>
            </Card>

            <Title style={styles.sectionTitle}>Test Results</Title>
            {Object.entries(test.results).map(([key, value], index) => (
                <Card key={index} style={styles.resultCard}>
                    <Card.Content>
                        <View style={styles.resultRow}>
                            <Title style={styles.resultText}>{key}</Title>
                            <Text style={styles.resultValue}>{value.value} {value.unit}</Text>
                        </View>
                        <Text style={styles.referenceRange}>Reference Range: {value.reference_range}</Text>
                        <Text style={[styles.status, styles[value.status.toLowerCase()]]}>{value.status}</Text>
                    </Card.Content>
                </Card>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10, backgroundColor: '#f3f3f3' },
    errorText: { textAlign: 'center', fontSize: 18, color: 'red', marginTop: 20 },
    card: { padding: 16, marginBottom: 16, borderRadius: 10, backgroundColor: '#fff', elevation: 3 },
    testType: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
    labInfo: { fontSize: 16, color: '#555' },
    testDate: { fontSize: 16, color: '#777' },
    interpretation: { fontSize: 14, fontStyle: 'italic', marginTop: 5 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, color: '#000' },
    resultCard: { padding: 16, marginBottom: 10, borderRadius: 10, backgroundColor: '#fff', elevation: 3 },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    resultText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    resultValue: { fontSize: 14, fontWeight: 'bold', color: '#000' },
    referenceRange: { fontSize: 12, fontStyle: 'italic', color: '#555', marginTop: 5 },
    status: { fontSize: 14, fontWeight: 'bold', marginTop: 5 },
    normal: { color: 'green' },
    high: { color: 'red' },
    low: { color: 'blue' }
});

export default TestDetails;
