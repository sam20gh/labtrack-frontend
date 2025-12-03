import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SplashScreen() {
    const router = useRouter();
    const spinValue = useRef(new Animated.Value(0)).current;
    const fadeValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Fade in animation
        Animated.timing(fadeValue, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();

        // Spinning animation for loader
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // Check auth status and navigate
        const checkAuth = async () => {
            await new Promise(resolve => setTimeout(resolve, 2500)); // Show splash for 2.5s

            try {
                const token = await AsyncStorage.getItem('authToken');
                const userId = await AsyncStorage.getItem('userId');
                const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

                if (token && userId) {
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
    }, []);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <LinearGradient
            colors={['#1a2a4a', '#0d1829']}
            style={styles.container}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
        >
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            <Animated.View style={[styles.content, { opacity: fadeValue }]}>
                {/* Logo */}
                <View style={styles.logoContainer}>
                    <View style={styles.logoIcon}>
                        <View style={styles.logoBar} />
                        <View style={styles.logoBarShort} />
                        <View style={styles.logoBar} />
                    </View>
                    <Text style={styles.logoText}>LabTrack</Text>
                </View>

                {/* Loading indicator */}
                <View style={styles.loaderContainer}>
                    <Animated.View style={[styles.loader, { transform: [{ rotate: spin }] }]}>
                        <View style={styles.loaderArc} />
                    </Animated.View>
                </View>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 60,
    },
    logoIcon: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginRight: 12,
        height: 32,
        gap: 4,
    },
    logoBar: {
        width: 6,
        height: 28,
        backgroundColor: '#fff',
        borderRadius: 3,
    },
    logoBarShort: {
        width: 6,
        height: 18,
        backgroundColor: '#fff',
        borderRadius: 3,
    },
    logoText: {
        fontSize: 32,
        fontWeight: '600',
        color: '#fff',
        letterSpacing: 1,
    },
    loaderContainer: {
        position: 'absolute',
        bottom: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loader: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderArc: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: 'transparent',
        borderTopColor: '#fff',
        borderRightColor: '#fff',
    },
});
