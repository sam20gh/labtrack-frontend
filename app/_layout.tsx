import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  ChakraPetch_400Regular,
  ChakraPetch_500Medium,
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
} from '@expo-google-fonts/chakra-petch';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { BasketProvider } from '@/lib/basket';
import { StripeProvider } from '@stripe/stripe-react-native';
import { getPaymentStatus } from '@/lib/payments';
import * as Notifications from 'expo-notifications';
import { routeForNotification } from '@/lib/notifications';
import { useRouter } from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
ExpoSplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Fetched rather than hardcoded: swapping Stripe accounts should not need a new build
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    getPaymentStatus()
      .then((s) => setPublishableKey(s.publishableKey))
      .catch(() => setPublishableKey(null));
  }, []);

  // A tapped notification should land on the thing it is about, not the home screen
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = routeForNotification(response.notification.request.content.data);
      if (route) router.push(route as any);
    });

    // Cold start: the app was launched *by* the notification, so no listener fired
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const route = routeForNotification(response.notification.request.content.data);
      if (route) setTimeout(() => router.push(route as any), 800);
    });

    return () => subscription.remove();
  }, [router]);
  // Chakra Petch is registered per weight: Android cannot synthesise a bold from a
  // regular face, so each weight the UI uses has to be its own family. Keys here are the
  // family names `constants/theme.ts` refers to.
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ChakraPetch_400Regular,
    ChakraPetch_500Medium,
    ChakraPetch_600SemiBold,
    ChakraPetch_700Bold,
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
        <Stack.Screen name="biomarker/[name]" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="assistant/intro" options={{ headerShown: false }} />
        <Stack.Screen name="assistant/immersive" options={{ headerShown: false }} />
        <Stack.Screen name="assistant/settings" options={{ headerShown: false }} />
        <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
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
