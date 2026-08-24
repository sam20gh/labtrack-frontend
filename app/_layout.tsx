import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { BasketProvider } from '@/lib/basket';
import { StripeProvider } from '@stripe/stripe-react-native';
import { getPaymentStatus } from '@/lib/payments';

// Prevent the splash screen from auto-hiding before asset loading is complete.
ExpoSplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Fetched rather than hardcoded: swapping Stripe accounts should not need a new build
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  useEffect(() => {
    getPaymentStatus()
      .then((s) => setPublishableKey(s.publishableKey))
      .catch(() => setPublishableKey(null));
  }, []);
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      ExpoSplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StripeProvider publishableKey={publishableKey ?? ''} merchantIdentifier="merchant.com.labtrack.app">
      <BasketProvider>
      <Stack initialRouteName="SplashScreen">
        <Stack.Screen name="SplashScreen" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/loginscreen" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="health-assessment" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="auth/reset" options={{ headerShown: false }} />
        <Stack.Screen name="add-result" options={{ headerShown: false }} />
        <Stack.Screen name="basket" options={{ headerShown: false }} />
        <Stack.Screen name="clinician" options={{ headerShown: false }} />
        <Stack.Screen name="order-details" options={{ headerShown: false }} />
        <Stack.Screen name="orders-history" options={{ title: "Your orders", headerShown: true }} />
        <Stack.Screen name="users" options={{ headerShown: true }} />
        <Stack.Screen name="professionalDetails" options={{ title: "Professional Details", headerShown: true }} />
        <Stack.Screen name="ProductDetails" options={{ title: "Product Details", headerShown: true }} />
        <Stack.Screen name="myplans" options={{ title: "My Plans", headerShown: true }} />
      </Stack>

        <StatusBar style="auto" />
      </BasketProvider>
      </StripeProvider>
    </ThemeProvider>
  );
}
