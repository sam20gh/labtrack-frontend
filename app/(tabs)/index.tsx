import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Appbar, Button, Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config'; // Using centralized API URL
import { LinearGradient } from 'expo-linear-gradient';

const TEST_RESULTS_URL = `${API_URL}/test-results`;

const HomeScreen = ({ navigation }: any) => {
  const [testResults, setTestResults] = useState<any[]>([]); // Ensuring it's an array
  const [loading, setLoading] = useState(true);

  // Fetch test results from API
  useEffect(() => {
    const fetchTestResults = async () => {
      try {
        const response = await fetch(TEST_RESULTS_URL);
        const data = await response.json();

        // Ensure it's an array, handling cases where data might be an object
        setTestResults(Array.isArray(data) ? data : data?.results || []);
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
            {testResults.map((result: any, index: number) => (
              <View key={result.id || index} style={[styles.resultRow]}>
                <View style={[styles.statusIndicator, getStatusColor(result.status)]} />
                <View style={styles.resultTextContainer}>
                  <Title style={styles.resultText}>{result.testName || "Unknown Test"}</Title>
                </View>
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
    shadowColor: '#d1d1d1', // Lighter shadow color
    shadowOpacity: 0.3, // Increase opacity for visibility
    shadowRadius: 10, // More spread
    shadowOffset: { width: 0, height: 4 }, // Adjust shadow direction
    elevation: 5 // Android shadow
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 5, borderRadius: 5, backgroundColor: '#f5f5f5', shadowColor: '#bdbdbd', shadowOpacity: 0.05, shadowRadius: 5 },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  resultTextContainer: { flex: 1 },
  resultText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  noResultsText: { textAlign: 'center', fontSize: 16, color: '#666', marginVertical: 10 },
  normal: { backgroundColor: 'green' },
  high: { backgroundColor: 'red' },
  pending: { backgroundColor: 'yellow' },
  default: { backgroundColor: 'gray' }
});

export default HomeScreen;
