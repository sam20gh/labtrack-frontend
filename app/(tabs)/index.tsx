import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Text } from 'react-native';
import { Card, Title, Paragraph, ActivityIndicator } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const calculateBMI = (weight: number, heightCm: number) => {
  if (!weight || !heightCm) return 'N/A';
  const heightM = heightCm / 100; // Convert cm to meters
  return (weight / (heightM * heightM)).toFixed(1);
};

const HomeScreen = ({ navigation }: any) => {
  const [userData, setUserData] = useState<any>(null);
  const [latestTest, setLatestTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          setLatestTest(Array.isArray(data) ? data[0] : data);
        }
      } catch (error) {
        console.error('Error fetching latest test result:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    fetchLatestTestResult();
  }, []);

  const userFirstName = userData?.firstName ?? 'User';
  const userAge = userData?.dob ? Math.max(0, new Date().getFullYear() - new Date(userData.dob).getFullYear()) : 'N/A';
  const userHeight = userData?.height ? (userData.height / 100).toFixed(2) : 'N/A';
  const userWeight = userData?.weight ?? 'N/A';
  const userBMI = calculateBMI(userWeight, userData?.height);

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
          <Card style={styles.statCard}><Card.Content><View style={styles.cardRow}><Icon name="calendar" size={30} color="#FF385C" /><View><Title>Age</Title><Paragraph>{userAge} years</Paragraph></View></View></Card.Content></Card>
          <Card style={styles.statCard}><Card.Content><View style={styles.cardRow}><Icon name="human-male-height" size={30} color="#FF385C" /><View><Title>Height</Title><Paragraph>{userHeight} m</Paragraph></View></View></Card.Content></Card>
          <Card style={styles.statCard}><Card.Content><View style={styles.cardRow}><Icon name="weight-kilogram" size={30} color="#FF385C" /><View><Title>Weight</Title><Paragraph>{userWeight} kg</Paragraph></View></View></Card.Content></Card>
          <Card style={styles.statCard}><Card.Content><View style={styles.cardRow}><Icon name="heart-pulse" size={30} color="#FF385C" /><View><Title>BMI</Title><Paragraph>{userBMI}</Paragraph></View></View></Card.Content></Card>
        </View>
      )}

      {latestTest && (
        <View style={styles.latestTestContainer}>
          <Title>Latest Test Result</Title>
          <Paragraph><Icon name="hospital" size={18} color="#FF385C" /> Lab: {latestTest?.patient?.lab_name ?? 'Unknown'}</Paragraph>
          <Paragraph><Icon name="calendar" size={18} color="#FF385C" /> Date: {latestTest?.patient?.date_of_test ?? 'Unknown'}</Paragraph>
          <Paragraph><Icon name="information-outline" size={18} color="#FF385C" /> {latestTest?.interpretation ?? 'No interpretation available'}</Paragraph>
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
});

export default HomeScreen;