import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Appbar, Button, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config'; // Using centralized API URL
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TEST_RESULTS_URL = `${API_URL}/test-results`;

const HomeScreen = ({ navigation }: any) => {
  const [testResults, setTestResults] = useState<any[]>([]); // Ensuring it's an array
  const [loading, setLoading] = useState(true);
  const [labInfo, setLabInfo] = useState<any>(null);
  const [expandedTest, setExpandedTest] = useState<number | null>(null);

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
            value: `${value.value} ${value.unit}`,
            referenceRange: value.reference_range
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
                <View style={styles.labInfoContainer}>
                  <Icon name="hospital" size={16} color="#777" />
                  <Text style={styles.labName}>{labInfo.labName}</Text>
                  <Icon name="calendar" size={16} color="#777" style={styles.labIcon} />
                  <Text style={styles.labDate}>{labInfo.dateOfTest}</Text>
                </View>
                <Paragraph style={styles.interpretation}>{labInfo.interpretation}</Paragraph>
              </View>
            )}
            {testResults.map((result: any, index: number) => (
              <TouchableOpacity key={result.id || index} onPress={() => setExpandedTest(expandedTest === result.id ? null : result.id)}>
                <View style={[styles.resultRow]}>
                  <View style={[styles.statusIndicator, getStatusColor(result.status)]} />
                  <View style={styles.resultTextContainer}>
                    <Title style={styles.resultText}>{result.testName || "Unknown Test"}</Title>
                  </View>
                  <Text style={styles.resultValue}>{result.value}</Text>
                </View>
                {expandedTest === result.id && (
                  <Text style={styles.referenceRange}>Reference Range: {result.referenceRange}</Text>
                )}
              </TouchableOpacity>
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
  interpretation: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 5 },
  labInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  labName: { fontSize: 14, color: '#777', marginLeft: 5 },
  labDate: { fontSize: 14, color: '#777', marginLeft: 5 },
  labIcon: { marginLeft: 10 },
  referenceRange: { fontSize: 12, fontStyle: 'italic', color: '#555', padding: 20, marginTop: 5 },
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