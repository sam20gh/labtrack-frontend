import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';


const ProfileScreen = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const [user, setUser] = useState({ firstName: '', profileImage: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const userId = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('authToken');

      if (!userId || !token) {
        router.replace('/(auth)/loginscreen');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          router.replace('/(auth)/loginscreen');
          return;
        }

        const userData = await response.json();
        setUser({
          firstName: userData.firstName,
          profileImage: userData.profileImage || 'https://i.pravatar.cc/150'
        });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Unable to fetch user data' });
        router.replace('/(auth)/loginscreen');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);
  const handleLogout = async () => {
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('authToken');
    Toast.show({ type: 'info', text1: 'Logged out', text2: 'Your session has expired. Please log in again.' });
    router.replace('/(auth)/loginscreen');
  };

  const handleProfileClick = () => {
    router.push('/users');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.profileText}>Profile</Text>
        <MaterialIcons name="notifications-none" size={24} />
      </View>

      {/* User Profile Section */}
      <TouchableOpacity style={styles.userSection} onPress={handleProfileClick}>
        <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.firstName}</Text>
          <Text style={styles.userSubtitle}>Show profile</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} />
      </TouchableOpacity>

      {/* Card content */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Take your first test</Text>
        <Text style={styles.cardSubtitle}>
          It's easy to monitor your health with our tests. Get started now!
        </Text>
      </View>

      {/* My Plans Row */}
      <TouchableOpacity
        style={[styles.settingItem, { borderTopWidth: 1, borderTopColor: '#eaeaea' }]}
        onPress={() => router.push('/myplans')}
      >
        <Text style={styles.settingText}>My Health Plans</Text>
        <MaterialIcons name="chevron-right" size={24} />
      </TouchableOpacity>

      {/* Settings */}
      <View style={styles.settings}>
        {['Personal information', 'Login & security', 'Payments and payouts'].map((item, index) => (
          <TouchableOpacity key={index} style={styles.settingItem}>
            <Text style={styles.settingText}>{item}</Text>
            <MaterialIcons name="chevron-right" size={24} />
          </TouchableOpacity>
        ))}
      </View>
      {/* Version Display */}
      <Text style={styles.versionText}>
        Version {Constants.expoConfig?.version || '1.0.0'}
      </Text>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      <Toast />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e1e1e1',
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userSubtitle: {
    fontSize: 14,
    color: 'grey',
  },
  card: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 12,
    marginVertical: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'grey',
    marginTop: 5,
  },
  settings: {
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  settingText: {
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  logoutButton: {
    marginTop: 30,
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FF385C',
  },
  logoutButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#888',
    marginTop: 20,
    marginBottom: 10,
  },


});

export default ProfileScreen;
