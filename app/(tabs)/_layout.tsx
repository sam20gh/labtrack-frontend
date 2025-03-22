import React from 'react';
import { Platform, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import Header from '@/components/Header';
import Ionicons from 'react-native-vector-icons/Ionicons';
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <Header />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FF385C',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarLabelStyle: {
            fontSize: 10, // 🔹 Reduce font size for better readability
            fontWeight: '500',
          },
          tabBarStyle: {
            paddingBottom: 10, // 🔹 Add padding below the icons
            paddingTop: 5, // 🔹 Add some space above the icons
            height: 60, // 🔹 Adjust height for better spacing
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: () => <Text>Home</Text>,
            tabBarIcon: ({ color }) => <Ionicons size={22} name="home-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="professionals"
          options={{
            title: () => <Text>Pros</Text>,
            tabBarIcon: ({ color }) => <Ionicons size={22} name="briefcase-outline" color={color} />,
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title: () => <Text>Order</Text>,
            tabBarIcon: ({ color }) => <Ionicons size={22} name="bag-add-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: () => <Text>Results</Text>,
            tabBarIcon: ({ color }) => <Ionicons size={22} name="analytics-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="ProfileScreen"
          options={{
            title: () => <Text>Profile</Text>,
            tabBarIcon: ({ color }) => <Ionicons size={22} name="finger-print-outline" color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
