import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator, Button } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import Toast from 'react-native-toast-message';



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
          const token = await AsyncStorage.getItem('authToken');

          if (!userId || !token) return;

          const response = await fetch(`${API_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          const data = await response.json();

          if (response.status === 401 || response.status === 403) return;

          if (response.ok) {
            setUserData(data);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };


      const fetchLatestTestResult = async () => {
        try {
          const userId = await AsyncStorage.getItem('userId');
          const token = await AsyncStorage.getItem('authToken');
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
            console.log("🔍 latestTest object:", latestTest);
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

      console.log("📢 Checking existing feedback for user:", userData);
      console.log("📌 Checking latest test:", latestTest);

      if (!latestTest || !latestTest._id) {
        console.error("❌ No valid test ID found.");
        Toast.show({ type: 'error', text1: 'Error', text2: 'No valid test found.' });
        setLoadingFeedback(false);
        return;
      }

      const testID = latestTest._id; // ✅ Ensure we use the correct test result ID

      // Step 1: Check if feedback already exists in the database
      console.log("🔍 Searching for existing feedback...");
      const feedbackResponse = await fetch(`${API_URL}/aifeedback/get/${testID}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const feedbackData = await feedbackResponse.json();
      if (feedbackResponse.ok && feedbackData.feedback) {
        console.log("🟢 Existing feedback found:", feedbackData.feedback);
        setDeepSeekFeedback(feedbackData.feedback);
        setLoadingFeedback(false);
        return;
      }

      console.log("📌 No existing feedback found. Calling DeepSeek API...");

      // Step 2: Fetch AI feedback
      const deepseekResponse = await fetch(`${API_URL}/deepseek`, {
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

      const deepseekData = await deepseekResponse.json();
      console.log("🟢 DeepSeek API Response:", deepseekData);

      if (!deepseekResponse.ok) {
        throw new Error(deepseekData.message || "Failed to fetch feedback.");
      }

      setDeepSeekFeedback(deepseekData.recommendation);

      // Step 3: Save feedback in the database
      console.log("📌 Saving new feedback to DB...");
      await saveFeedback(deepseekData.recommendation, testID, userId, token);

    } catch (error) {
      console.error("❌ Error fetching DeepSeek feedback:", error);
      setDeepSeekFeedback("An error occurred while fetching feedback.");
    } finally {
      setLoadingFeedback(false);
    }
  };


  const saveFeedback = async (feedbackText: string, testID: string, userID: string, token: string) => {
    try {
      console.log("📢 Sending feedback to backend:", { userID, testID, feedback: feedbackText });

      if (!testID) {
        console.error("❌ No testID provided! Cannot save feedback.");
        Toast.show({ type: 'error', text1: 'Error', text2: 'No valid test ID found.' });
        return;
      }

      const response = await fetch(`${API_URL}/aifeedback/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userID, testID, feedback: feedbackText })
      });

      console.log("🔍 Raw Response:", response); // ✅ Log full response object

      const textData = await response.text(); // ✅ Read response as text
      console.log("🔍 Response Text:", textData); // ✅ Log the text response

      // Try parsing JSON only if the response is valid
      let data;
      try {
        data = JSON.parse(textData);
      } catch (error) {
        console.error("❌ JSON Parsing Error:", error);
        throw new Error("Invalid JSON response from server.");
      }

      console.log("🟢 Backend response (Parsed JSON):", data);

      if (response.ok) {
        Toast.show({ type: 'success', text1: 'Success', text2: 'Feedback saved!' });
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'Failed to save feedback' });
      }
    } catch (error) {
      console.error('❌ Error saving feedback:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Server error' });
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
                <Icon name="calendar" size={20} color="#FF385C" />
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
                <Icon name="human-male-height" size={20} color="#FF385C" />
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
                <Icon name="weight-kilogram" size={20} color="#FF385C" />
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
                <Icon name="heart-pulse" size={20} color={getBMIIconColor(userBMI)} />
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
            <Icon name="hospital" size={18} color="#FF385C" /> Type: {latestTest?.patient?.test_type ?? 'Unknown'}
          </Paragraph>
          <Paragraph>
            <Icon name="doctor" size={18} color="#FF385C" /> Lab: {latestTest?.patient?.lab_name ?? 'Unknown'}
          </Paragraph>

          <Paragraph>
            <Icon name="calendar" size={18} color="#FF385C" /> Date: {latestTest?.patient?.date_of_test ?? 'Unknown'}
          </Paragraph>
          <Paragraph>
            <Icon name="information-outline" size={18} color="#FF385C" /> {latestTest?.interpretation ?? 'No interpretation available'}
          </Paragraph>
          <View style={styles.deepSeekContainer}>
            <Button mode="contained" onPress={handleDeepSeekFeedback} style={styles.deepSeekButton}>
              {loadingFeedback ? <ActivityIndicator color="white" size="small" /> : "Get LabTrack AI Feedback"}
            </Button>
            {deepSeekFeedback !== '' && (
              <View>

                <Title style={styles.feedbackTitle}>LabTrack AI Feedback</Title>
                <Markdown>{deepSeekFeedback}</Markdown>

              </View>
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
  cardRow: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  latestTestContainer: { padding: 16, marginTop: 20 },
  deepSeekContainer: { marginTop: 20 },
  deepSeekButton: { marginBottom: 10, backgroundColor: '#119658' },
  feedbackLoader: { marginVertical: 10 },
  feedbackBox: { marginTop: 10, padding: 5, backgroundColor: '#f0f0f0', borderRadius: 10 },
  feedbackTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  feedbackText: { fontSize: 16 },
  feedbackCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 5,
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
