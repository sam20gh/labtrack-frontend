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
import Toast from 'react-native-toast-message';

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
        {/* The nutrition tracker draws its own back bar inside a top-inset SafeAreaView.
            Left off this list it fell through to the Stack's default header, stacking a
            second bar titled "nutrition" above its own on every screen in the folder. */}
        <Stack.Screen name="nutrition" options={{ headerShown: false }} />
        {/* The symptom checker draws its own back bar inside a top-inset SafeAreaView.
            The root Stack has no default screenOptions, so a route left off this list
            gets a second header titled after its folder. */}
        <Stack.Screen name="symptoms" options={{ headerShown: false }} />
        {/* Draws its own "Your DNA" header inside a top-inset SafeAreaView, like every
            other screen here. Without this line the route falls through to the Stack's
            default header, which stacks a second bar titled "dna/[id]" above it. */}
        <Stack.Screen name="dna/[id]" options={{ headerShown: false }} />
        {/* The password-reset flow. Each screen draws its own header inside a top-inset
            SafeAreaView, so the Stack must not add a second one above it. */}
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password-email" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password-sms" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password-2fa" options={{ headerShown: false }} />
        <Stack.Screen name="password-reset-sent" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="assistant/intro" options={{ headerShown: false }} />
        <Stack.Screen name="assistant/immersive" options={{ headerShown: false }} />
        {/* Voice Mode is a full-screen takeover with its own close control and badge; a
            default header would stack a second bar titled "voice" above it. */}
        <Stack.Screen name="assistant/voice" options={{ headerShown: false }} />
        <Stack.Screen name="assistant/settings" options={{ headerShown: false }} />
        <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
        <Stack.Screen name="order-details" options={{ headerShown: false }} />
        <Stack.Screen name="orders-history" options={{ title: "Your orders", headerShown: true }} />
        <Stack.Screen name="users" options={{ headerShown: true }} />
        {/* Draws its own back bar inside a top-inset SafeAreaView. With the Stack header
            on, "Professional Details" stacked a second bar above that one. */}
        <Stack.Screen name="professionalDetails" options={{ headerShown: false }} />
        {/* The doctor-appointment flow: agenda, booking, confirmation. Each screen draws
            its own header, so the Stack must not add one. */}
        <Stack.Screen name="appointments" options={{ headerShown: false }} />
        <Stack.Screen name="ProductDetails" options={{ title: "Product Details", headerShown: true }} />
        <Stack.Screen name="myplans" options={{ title: "My Plans", headerShown: true }} />
      </Stack>

        <StatusBar style="auto" />
        {/* One instance at the root, so a screen that reports an outage or a rate limit is
            actually heard. Several screens still mount their own `<Toast />`; the library
            keeps a stack of refs and the last mounted wins, so those keep working and this
            one covers the screens that never had one — the home screen among them, where
            five Toast.show calls (including the "no new analysis needed" explanation) were
            landing on no renderer at all. */}
        <Toast />
      </BasketProvider>
      </StripeProvider>
    </ThemeProvider>
  );
}
