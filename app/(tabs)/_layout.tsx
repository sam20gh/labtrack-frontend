import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HapticTab } from '@/components/HapticTab';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import TabBarBackground from '@/components/ui/TabBarBackground';
import Header from '@/components/Header'; // Import the Header component

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <Header /> {/* Add Header component here */}
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FF385C',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Login',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="login" color={color} />,
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="account" color={color} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="shopping" color={color} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: 'Results',
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={28} name="chart-line" color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
