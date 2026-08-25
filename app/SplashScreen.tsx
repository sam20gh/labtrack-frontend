/**
 * Splash screen.
 *
 * Redrawn against the turing kit's splash frames: full-bleed purple, the flared cross mark
 * centred, and a determinate progress bar with a percentage at the foot rather than an
 * indeterminate spinner. The purple matches `expo.splash.backgroundColor` in `app.json`,
 * so the native splash hands off to this screen without a colour flash.
 *
 * The bar is honest about what it is: a 2.5s dwell, not a real load. It runs to 100% over
 * exactly the window we wait before routing, so it never sits full while nothing happens.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSignedIn } from '@/lib/auth';
import BrandMark from '@/components/BrandMark';
import { Fonts, Palette } from '@/constants/theme';

/** How long the mark is held on screen before we route. The bar is timed to match. */
const DWELL_MS = 2500;

export default function SplashScreen() {
    const router = useRouter();
    const fadeValue = useRef(new Animated.Value(0)).current;
    const scaleValue = useRef(new Animated.Value(0.82)).current;
    const progressValue = useRef(new Animated.Value(0)).current;
    const [percent, setPercent] = useState(0);

    useEffect(() => {
        // The mark eases up to full size as it fades in, so it reads as arriving rather
        // than blinking on.
        Animated.parallel([
            Animated.timing(fadeValue, {
                toValue: 1,
                duration: 700,
                useNativeDriver: true,
            }),
            Animated.spring(scaleValue, {
                toValue: 1,
                friction: 7,
                tension: 60,
                useNativeDriver: true,
            }),
        ]).start();

        Animated.timing(progressValue, {
            toValue: 1,
            duration: DWELL_MS,
            easing: Easing.inOut(Easing.quad),
            // Width cannot be driven natively, and the percentage label needs the value on
            // the JS side anyway.
            useNativeDriver: false,
        }).start();

        const listener = progressValue.addListener(({ value }) => {
            setPercent(Math.round(value * 100));
        });

        // Check auth status and navigate
        const checkAuth = async () => {
            await new Promise(resolve => setTimeout(resolve, DWELL_MS));

            try {
                const signedIn = await isSignedIn();
                const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

                if (signedIn) {
                    router.replace('/(tabs)');
                } else if (!hasSeenOnboarding) {
                    // First time user - show onboarding
                    router.replace('/onboarding');
                } else {
                    router.replace('/(auth)/loginscreen');
                }
            } catch (error) {
                router.replace('/(auth)/loginscreen');
            }
        };

        checkAuth();

        return () => progressValue.removeListener(listener);
    }, []);

    const barWidth = progressValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <LinearGradient
            colors={['#8B5CF6', Palette.primary, Palette.primaryDark]}
            style={styles.container}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
        >
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <Animated.View
                style={[
                    styles.content,
                    { opacity: fadeValue, transform: [{ scale: scaleValue }] },
                ]}
            >
                <BrandMark size={92} color={Palette.white} />
                <Text style={styles.wordmark}>LabTrack</Text>
                <Text style={styles.tagline}>Smart Health Starts Here.</Text>
            </Animated.View>

            <Animated.View style={[styles.footer, { opacity: fadeValue }]}>
                <View style={styles.track}>
                    <Animated.View style={[styles.fill, { width: barWidth }]} />
                </View>
                <Text style={styles.percent}>{percent}%</Text>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    wordmark: {
        fontSize: 34,
        fontFamily: Fonts.bold,
        color: Palette.white,
        letterSpacing: 1,
        marginTop: 28,
    },
    tagline: {
        fontSize: 14,
        fontFamily: Fonts.medium,
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 0.4,
        marginTop: 8,
    },
    footer: {
        position: 'absolute',
        left: 48,
        right: 48,
        bottom: 72,
        alignItems: 'center',
    },
    track: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.28)',
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: Palette.white,
    },
    percent: {
        marginTop: 14,
        fontSize: 13,
        fontFamily: Fonts.semibold,
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: 0.5,
    },
});
