import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Appbar, Button, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config'; // Using centralized API URL
import { LinearGradient } from 'expo-linear-gradient';

const TEST_RESULTS_URL = `${API_URL}/test-results`;

const HomeScreen = ({ navigation }: any) => {
  const [testResults, setTestResults] = useState<any[]>([]); // Ensuring it's an array
  const [loading, setLoading] = useState(true);
  const [labInfo, setLabInfo] = useState<any>(null);

  // Fetch test results from API
  useEffect(() => {
    const fetchTestResults = async () => {
      try {
        const response = await fetch(TEST_RESULTS_URL);
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          setLabInfo({
            dateOfTest: data[0].patient.date_of_test,
            labName: data[0].patient.lab_name,
            interpretation: data[0].interpretation
          });

          const parsedResults = Object.entries(data[0].results).map(([key, value]: any, index) => ({
            id: index + 1,
            testName: key,
            status: value.status,
            value: `${value.value} ${value.unit}`
          }));
          setTestResults(parsedResults);
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'normal': return styles.normal;
      case 'high': return styles.high;
      case 'pending': return styles.pending;
      default: return styles.default;
    }
  };

  return (
    <ScrollView style={styles.container}>
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
      ) : testResults.length > 0 ? (
        <Card style={styles.resultCard}>
          <Card.Content>
            {labInfo && (
              <View>
                <Title style={styles.labTitle}>Lab: {labInfo.labName}</Title>
                <Paragraph style={styles.labDate}>Date of Test: {labInfo.dateOfTest}</Paragraph>
                <Paragraph style={styles.interpretation}>{labInfo.interpretation}</Paragraph>
              </View>
            )}
            {testResults.map((result: any, index: number) => (
              <View key={result.id || index} style={[styles.resultRow]}>
                <View style={[styles.statusIndicator, getStatusColor(result.status)]} />
                <View style={styles.resultTextContainer}>
                  <Title style={styles.resultText}>{result.testName || "Unknown Test"}</Title>
                </View>
                <Text style={styles.resultValue}>{result.value}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      ) : (
        <Text style={styles.noResultsText}>No test results available</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 5, backgroundColor: '#f3f3f3', width: '100%' },
  appBar: { backgroundColor: '#fff' },
  heroSection: { alignItems: 'center', marginBottom: 20, padding: 40, backgroundColor: '#109f5e', borderRadius: 10 },
  heroTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  orderButtonText: { color: '#109f5e' },
  heroSubtitle: { fontSize: 16, color: '#e0e0e0', marginBottom: 10 },
  orderButton: { marginTop: 10, backgroundColor: 'white' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, color: '#000' },
  loader: { marginVertical: 20 },
  resultCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#d1d1d1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  labTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  labDate: { fontSize: 16, marginBottom: 5 },
  interpretation: { fontSize: 14, fontStyle: 'italic', marginBottom: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, marginBottom: 5, borderRadius: 5, backgroundColor: '#f5f5f5', shadowColor: '#bdbdbd', shadowOpacity: 0.05, shadowRadius: 5 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  resultTextContainer: { flex: 1 },
  resultText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  resultValue: { fontSize: 12, fontWeight: 'normal', color: '#888', marginLeft: 10 },
  noResultsText: { textAlign: 'center', fontSize: 16, color: '#666', marginVertical: 10 },
  normal: { backgroundColor: 'green' },
  high: { backgroundColor: 'red' },
  pending: { backgroundColor: 'yellow' },
  default: { backgroundColor: 'gray' }
});

export default HomeScreen;
