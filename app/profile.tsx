/**
 * The person's account, reached from the avatar in the home header.
 *
 * Was a tab. It lost that slot to the AI assistant, which is something people open many
 * times a session, where this is opened to change a setting and then left. Being a pushed
 * stack route also gives it the back affordance a destination screen should have — as a tab
 * it was a dead end you could only leave by picking another tab.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { getUserId, signOut } from '@/lib/auth';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette, Fonts } from '@/constants/theme';


const ProfileScreen = () => {
  const router = useRouter();
  const [user, setUser] = useState({ firstName: '', profileImage: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const userId = await getUserId();
      if (!userId) {
        router.replace('/(auth)/loginscreen');
        return;
      }

      try {
        const data = await api.get(`/users/${userId}`);
        setUser(data);
      } catch (error) {
        if (error instanceof ApiError && error.isAuthError) {
          router.replace('/(auth)/loginscreen');
          return;
        }
        Toast.show({ type: 'error', text1: 'Error', text2: 'Unable to fetch user data' });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);
  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/loginscreen');
  };

  const handleProfileClick = () => {
    router.push('/users');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <MaterialIcons name="chevron-left" size={28} color={Palette.text} />
        </TouchableOpacity>
        <Text style={styles.profileText}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/notification-settings')} accessibilityLabel="Notification settings">
          <MaterialIcons name="notifications-none" size={24} color={Palette.text} />
        </TouchableOpacity>
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

      {/* Health profile — the assessment answers, and the way back into them */}
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/health-assessment/review')}>
        <Text style={styles.settingText}>Health profile</Text>
        <MaterialIcons name="chevron-right" size={24} />
      </TouchableOpacity>

      {/* Orders */}
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/orders-history')}>
        <Text style={styles.settingText}>Your orders</Text>
        <MaterialIcons name="chevron-right" size={24} />
      </TouchableOpacity>

      {/* AI assistant — history and memory live with the assistant, its settings live here */}
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/assistant/settings')}>
        <Text style={styles.settingText}>AI assistant</Text>
        <MaterialIcons name="chevron-right" size={24} />
      </TouchableOpacity>

      {/* Notifications */}
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/notification-settings')}>
        <Text style={styles.settingText}>Notifications</Text>
        <MaterialIcons name="chevron-right" size={24} />
      </TouchableOpacity>

      {/* Clinician access — the screen itself requires professional credentials */}
      <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/clinician')}>
        <Text style={styles.settingText}>Clinician review queue</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  // Negative inset so the chevron's own padding does not push the title off the 20pt
  // gutter every other row on this screen aligns to.
  backButton: {
    marginLeft: -8,
    padding: 4,
  },
  profileText: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Palette.text,
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
    backgroundColor: Palette.primary,
    marginBottom: 60,
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
