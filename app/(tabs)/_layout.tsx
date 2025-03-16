import React from 'react';
import { Platform, Text } from 'react-native';
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
      <Header />
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
            title: () => <Text>Home</Text>,
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={24} name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="professionals"
          options={{
            title: () => <Text>Dr.</Text>,
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={24} name="face-man-profile" color={color} />,
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title: () => <Text>Orders</Text>,
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={24} name="shopping" color={color} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: () => <Text>Results</Text>,
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={24} name="chart-line" color={color} />,
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: () => <Text>Profile</Text>,
            tabBarIcon: ({ color }) => <MaterialCommunityIcons size={24} name="account" color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
