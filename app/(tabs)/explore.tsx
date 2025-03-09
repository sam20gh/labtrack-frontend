import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Card, Button, Avatar } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';

const AuthScreen = () => {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    const userId = await AsyncStorage.getItem('userId');
    if (userId) {
      fetchUserData(userId);
    }
  };

  const fetchUserData = async (userId) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Unauthorized');
      const response = await fetch(`${API_URL}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUserData(data);
      } else {
        throw new Error(data.message || 'Failed to fetch user data');
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error.message });
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('authToken');
    setUserData(null);
    router.replace('/(tabs)/explore');
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#FF385C" />
      ) : userData ? (
        <ScrollView>
          <Card style={styles.profileCard}>
            <Card.Content>
              <View style={styles.avatarContainer}>
                <Avatar.Image size={80} source={{ uri: userData.avatar || 'https://i.pravatar.cc/150' }} />
              </View>
              <Text style={styles.userName}>{userData.firstName} {userData.lastName}</Text>
              <Text style={styles.userEmail}>Email: {userData.email}</Text>
              <Button mode="contained" style={styles.button} onPress={handleLogout}>Logout</Button>
            </Card.Content>
          </Card>
        </ScrollView>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.title}>Login</Text>
          <TextInput placeholder="Username" value={form.username} onChangeText={(text) => setForm({ ...form, username: text })} style={styles.input} />
          <TextInput placeholder="Password" value={form.password} secureTextEntry onChangeText={(text) => setForm({ ...form, password: text })} style={styles.input} />
          <Button mode="contained" style={styles.button} onPress={() => { }}>Login</Button>
        </Card>
      )}
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  card: { width: '90%', padding: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
  profileCard: { padding: 20, marginTop: 20, borderRadius: 10, backgroundColor: 'white', elevation: 3 },
  avatarContainer: { alignItems: 'center', marginBottom: 15 },
  userName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#333' },
  userEmail: { fontSize: 16, textAlign: 'center', color: '#666' },
  input: { marginBottom: 10, borderWidth: 1, padding: 12, borderRadius: 5, borderColor: '#ccc', backgroundColor: '#f9f9f9' },
  button: { marginTop: 10, backgroundColor: '#FF385C' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' }
});

export default AuthScreen;
