import React from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
                    <View style={styles.headerRow}>
                        <Icon name="flask-outline" size={26} color="#6200ea" />
                        <Title style={styles.testType}>{test.patient.test_type}</Title>
                    </View>
                    <Paragraph style={styles.labInfo}><Icon name="hospital" size={18} color="#666" /> Lab: {test.patient.lab_name}</Paragraph>
                    <Paragraph style={styles.testDate}><Icon name="calendar" size={18} color="#666" /> Date: {test.patient.date_of_test}</Paragraph>
                    <Paragraph style={styles.interpretation}>{test.interpretation}</Paragraph>
                </Card.Content>
            </Card>

            <Title style={styles.sectionTitle}><Text>Test Results</Text></Title>
            <View style={styles.resultsContainer}>
                {Object.entries(test.results).map(([key, value], index) => (
                    <View key={index} style={styles.resultItem}>
                        <Icon name="test-tube" size={22} color="#6200ea" style={styles.resultIcon} />
                        <View style={styles.resultTextContainer}>
                            <Title style={styles.resultText}>{key}</Title>
                            <Text style={styles.resultValue}>{value.value} {value.unit}</Text>
                            <Text style={styles.referenceRange}>Reference: {value.reference_range}</Text>
                            <Text style={[styles.status, styles[value.status.toLowerCase()]]}>{value.status}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 10, backgroundColor: '#f9f9f9' },
    errorText: { textAlign: 'center', fontSize: 18, color: 'red', marginTop: 20 },
    card: { padding: 15, marginBottom: 16, borderRadius: 10, backgroundColor: '#fff', elevation: 3 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    testType: { fontSize: 20, fontWeight: 'bold', marginLeft: 8, color: '#333' },
    labInfo: { fontSize: 16, color: '#555', marginVertical: 3 },
    testDate: { fontSize: 16, color: '#777', marginVertical: 3 },
    interpretation: { fontSize: 14, fontStyle: 'italic', marginTop: 5, color: '#333' },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, color: '#000', textAlign: 'center' },
    resultsContainer: { marginTop: 10 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, marginVertical: 6, borderRadius: 8, elevation: 2 },
    resultIcon: { marginRight: 10 },
    resultTextContainer: { flex: 1 },
    resultText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    resultValue: { fontSize: 14, fontWeight: 'bold', color: '#000' },
    referenceRange: { fontSize: 12, fontStyle: 'italic', color: '#555' },
    status: { fontSize: 14, fontWeight: 'bold', marginTop: 3 },
    normal: { color: 'green' },
    high: { color: 'red' },
    low: { color: 'blue' }
});

export default TestDetails;
