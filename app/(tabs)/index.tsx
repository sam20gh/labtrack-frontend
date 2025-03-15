import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Button } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';


const calculateBMI = (weight: number, heightCm: number) => {
  if (!weight || !heightCm) return 'N/A';
  const heightM = heightCm / 100; // Convert cm to meters
  return (weight / (heightM * heightM)).toFixed(1);
};

const getBMIIconColor = (bmi: string): string => {
  const bmiValue = parseFloat(bmi);
  if (isNaN(bmiValue)) return '#FF385C'; // Default color if BMI is invalid
  if (bmiValue < 18.5) return 'yellow';
  if (bmiValue < 25) return 'green';
  if (bmiValue < 30) return 'red';
  return 'darkred';
};

const HomeScreen = ({ navigation }: any) => {
  const [userData, setUserData] = useState<any>(null);
  const [latestTest, setLatestTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deepSeekFeedback, setDeepSeekFeedback] = useState<string>('');
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      const fetchUserData = async () => {
        try {
          const userId = await AsyncStorage.getItem('userId');
          if (!userId) return;
          const response = await fetch(`${API_URL}/users/${userId}`);
          const data = await response.json();
          setUserData(data);
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };

      const fetchLatestTestResult = async () => {
        try {
          const userId = await AsyncStorage.getItem('userId');
          if (!userId) return;
          const response = await fetch(`${API_URL}/test-results?user_id=${userId}`);
          const data = await response.json();
          if (data) {
            let resultsArray = Array.isArray(data) ? data : [data];
            // Sort the test results by date_of_test in descending order (latest first)
            resultsArray.sort(
              (a, b) =>
                new Date(b.patient.date_of_test).getTime() -
                new Date(a.patient.date_of_test).getTime()
            );
            setLatestTest(resultsArray[0]);
          }
        } catch (error) {
          console.error('Error fetching latest test result:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
      fetchLatestTestResult();
    }, [])
  );

  const userFirstName = userData?.firstName ?? 'User';
  const userAge = userData?.dob
    ? Math.max(0, new Date().getFullYear() - new Date(userData.dob).getFullYear())
    : 'N/A';
  const userHeight = userData?.height ? (userData.height / 100).toFixed(2) : 'N/A';
  const userWeight = userData?.weight ?? 'N/A';
  const userBMI = calculateBMI(userWeight, userData?.height);

  const handleDeepSeekFeedback = async () => {
    setLoadingFeedback(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');

      if (!token || !userId) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Unauthorized. Please log in again.' });
        return;
      }

      console.log("Fetching feedback for:", userData, latestTest);

      const response = await fetch(`${API_URL}/deepseek`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user: {
            gender: userData?.gender || 'N/A',
            height: userData?.height || 0,
            weight: userData?.weight || 0,
            dob: userData?.dob || 'N/A',
          },
          testResult: {
            type: latestTest?.patient?.test_type || 'N/A',
            result: latestTest?.interpretation || 'N/A',
          }
        })
      });

      const data = await response.json();
      console.log("DeepSeek API Response:", data);

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch feedback.");
      }

      setDeepSeekFeedback(data.recommendation);
    } catch (error) {
      console.error("Error fetching DeepSeek feedback:", error);
      setDeepSeekFeedback("An error occurred while fetching feedback.");
    } finally {
      setLoadingFeedback(false);
    }
  };


  return (
    <ScrollView style={styles.container}>
      <View style={styles.heroSection}>
        <Title style={styles.heroTitle}>Welcome {userFirstName}</Title>
        <Paragraph style={styles.heroSubtitle}>Your health, simplified.</Paragraph>
      </View>

      {loading ? (
        <ActivityIndicator animating={true} size="large" style={styles.loader} />
      ) : (
        <View style={styles.cardGrid}>
          <Card style={styles.statCard}>
            <Card.Content>
              <View style={styles.cardRow}>
                <Icon name="calendar" size={30} color="#FF385C" />
                <View>
                  <Title>Age</Title>
                  <Paragraph>{userAge} years</Paragraph>
                </View>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <View style={styles.cardRow}>
                <Icon name="human-male-height" size={30} color="#FF385C" />
                <View>
                  <Title>Height</Title>
                  <Paragraph>{userHeight} m</Paragraph>
                </View>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <View style={styles.cardRow}>
                <Icon name="weight-kilogram" size={30} color="#FF385C" />
                <View>
                  <Title>Weight</Title>
                  <Paragraph>{userWeight} kg</Paragraph>
                </View>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <View style={styles.cardRow}>
                <Icon name="heart-pulse" size={30} color={getBMIIconColor(userBMI)} />
                <View>
                  <Title>BMI</Title>
                  <Paragraph>{userBMI}</Paragraph>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
      )}

      {latestTest && (
        <View style={styles.latestTestContainer}>
          <Title>Latest Test Result</Title>
          <Paragraph>
            <Icon name="hospital" size={18} color="#FF385C" /> Lab: {latestTest?.patient?.lab_name ?? 'Unknown'}
          </Paragraph>
          <Paragraph>
            <Icon name="calendar" size={18} color="#FF385C" /> Date: {latestTest?.patient?.date_of_test ?? 'Unknown'}
          </Paragraph>
          <Paragraph>
            <Icon name="information-outline" size={18} color="#FF385C" /> {latestTest?.interpretation ?? 'No interpretation available'}
          </Paragraph>
          <View style={styles.deepSeekContainer}>
            <Button mode="contained" onPress={handleDeepSeekFeedback} style={styles.deepSeekButton}>
              {loadingFeedback ? <ActivityIndicator color="white" size="small" /> : "Get LabTrack Feedback"}
            </Button>
            {deepSeekFeedback !== '' && (
              <Card style={styles.feedbackCard}>
                <Card.Content>
                  <Title style={styles.feedbackTitle}>LabTrack Feedback</Title>
                  <Paragraph style={styles.feedbackText}>{deepSeekFeedback}</Paragraph>
                </Card.Content>
              </Card>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: 'transparent', width: '100%' },
  heroSection: { alignItems: 'center', marginBottom: 20, padding: 40, backgroundColor: '#FF385C', borderRadius: 10 },
  heroTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  heroSubtitle: { fontSize: 16, color: '#e0e0e0', marginBottom: 10 },
  loader: { marginVertical: 20 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 10 },
  statCard: { width: '48%', padding: 16, marginBottom: 10, borderRadius: 10, backgroundColor: '#ffffff', elevation: 3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  latestTestContainer: { padding: 16, marginTop: 20 },
  deepSeekContainer: { marginTop: 20 },
  deepSeekButton: { marginBottom: 10, backgroundColor: '#119658' },
  feedbackLoader: { marginVertical: 10 },
  feedbackBox: { marginTop: 10, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 10 },
  feedbackTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  feedbackText: { fontSize: 16 },
  feedbackCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 15,
    elevation: 3,
    marginTop: 15,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#119658",
  },
  feedbackText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
});

export default HomeScreen;
