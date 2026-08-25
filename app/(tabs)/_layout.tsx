import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Palette } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
        screenOptions={{
          tabBarActiveTintColor: Palette.primary,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarInactiveTintColor: Palette.textMuted,
          tabBarLabelStyle: {
            fontSize: 10,
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
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons size={22} name="home-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="professionals"
          options={{
            title: 'Pros',
            tabBarIcon: ({ color }) => <Ionicons size={22} name="briefcase-outline" color={color} />,
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title: 'Order',
            tabBarIcon: ({ color }) => <Ionicons size={22} name="bag-add-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="results"
          options={{
            title: 'Results',
            tabBarIcon: ({ color }) => <Ionicons size={22} name="analytics-outline" color={color} />,
          }}
        />
        {/*
          The fifth slot is the assistant, not the profile. The profile is reachable from
          the avatar in the home header and is a screen people visit to change something and
          leave; the assistant is opened repeatedly within a session, which is what a tab is
          for. It lives at `app/profile.tsx` now.
        */}
        <Tabs.Screen
          name="assistant"
          options={{
            title: 'Assistant',
            tabBarIcon: ({ color }) => <Ionicons size={22} name="sparkles-outline" color={color} />,
          }}
        />
    </Tabs>
  );
}
