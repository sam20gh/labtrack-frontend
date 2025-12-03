import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Animated,
    Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function CompleteScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Animation values
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(0)).current;
    const confettiAnims = useRef(
        Array.from({ length: 12 }, () => ({
            translateY: new Animated.Value(-50),
            translateX: new Animated.Value(0),
            rotate: new Animated.Value(0),
            opacity: new Animated.Value(1),
        }))
    ).current;

    useEffect(() => {
        // Entrance animation sequence
        Animated.sequence([
            // Circle scale in
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            // Check mark appears
            Animated.timing(checkAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Fade in content
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            delay: 400,
            useNativeDriver: true,
        }).start();

        // Confetti animation
        confettiAnims.forEach((anim, index) => {
            const randomX = (Math.random() - 0.5) * width;
            const delay = index * 50;

            Animated.sequence([
                Animated.delay(300 + delay),
                Animated.parallel([
                    Animated.timing(anim.translateY, {
                        toValue: 400,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim.translateX, {
                        toValue: randomX,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim.rotate, {
                        toValue: Math.random() * 4 - 2,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim.opacity, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        });
    }, []);

    const handleGoToHome = () => {
        // Navigate to home/tabs and reset the stack
        router.replace('/(tabs)');
    };

    const handleViewProfile = () => {
        router.replace('/(tabs)/ProfileScreen');
    };

    const confettiColors = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

    return (
        <SafeAreaView style={styles.container}>
            {/* Confetti */}
            <View style={styles.confettiContainer}>
                {confettiAnims.map((anim, index) => (
                    <Animated.View
                        key={index}
                        style={[
                            styles.confetti,
                            {
                                backgroundColor: confettiColors[index % confettiColors.length],
                                left: (width / 12) * index,
                                transform: [
                                    { translateY: anim.translateY },
                                    { translateX: anim.translateX },
                                    {
                                        rotate: anim.rotate.interpolate({
                                            inputRange: [-2, 2],
                                            outputRange: ['-180deg', '180deg'],
                                        })
                                    },
                                ],
                                opacity: anim.opacity,
                            },
                        ]}
                    />
                ))}
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Success Animation */}
                <Animated.View
                    style={[
                        styles.successCircle,
                        {
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <View style={styles.innerCircle}>
                        <Animated.View style={{ opacity: checkAnim }}>
                            <Ionicons name="checkmark" size={80} color="#fff" />
                        </Animated.View>
                    </View>
                </Animated.View>

                {/* Text Content */}
                <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
                    <Text style={styles.title}>Assessment Complete!</Text>
                    <Text style={styles.subtitle}>
                        Great job! Your health profile has been created. We'll use this information to provide personalized insights and recommendations.
                    </Text>

                    {/* Summary Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <View style={styles.statIcon}>
                                <Ionicons name="document-text" size={24} color="#7C3AED" />
                            </View>
                            <Text style={styles.statLabel}>Profile</Text>
                            <Text style={styles.statValue}>Complete</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <View style={styles.statIcon}>
                                <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                            </View>
                            <Text style={styles.statLabel}>Data</Text>
                            <Text style={styles.statValue}>Secured</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <View style={styles.statIcon}>
                                <Ionicons name="analytics" size={24} color="#3B82F6" />
                            </View>
                            <Text style={styles.statLabel}>Insights</Text>
                            <Text style={styles.statValue}>Ready</Text>
                        </View>
                    </View>

                    {/* What's Next */}
                    <View style={styles.nextStepsContainer}>
                        <Text style={styles.nextStepsTitle}>What's Next?</Text>
                        <View style={styles.nextStepItem}>
                            <View style={styles.nextStepNumber}>
                                <Text style={styles.nextStepNumberText}>1</Text>
                            </View>
                            <Text style={styles.nextStepText}>Explore personalized health recommendations</Text>
                        </View>
                        <View style={styles.nextStepItem}>
                            <View style={styles.nextStepNumber}>
                                <Text style={styles.nextStepNumberText}>2</Text>
                            </View>
                            <Text style={styles.nextStepText}>Order health tests tailored to your profile</Text>
                        </View>
                        <View style={styles.nextStepItem}>
                            <View style={styles.nextStepNumber}>
                                <Text style={styles.nextStepNumberText}>3</Text>
                            </View>
                            <Text style={styles.nextStepText}>Connect with healthcare professionals</Text>
                        </View>
                    </View>
                </Animated.View>
            </View>

            {/* Bottom Buttons */}
            <Animated.View style={[styles.bottomContainer, { opacity: fadeAnim }]}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleGoToHome}>
                    <Text style={styles.primaryButtonText}>Go to Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleViewProfile}>
                    <Text style={styles.secondaryButtonText}>View My Profile</Text>
                </TouchableOpacity>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    confettiContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
        overflow: 'hidden',
    },
    confetti: {
        position: 'absolute',
        width: 10,
        height: 20,
        borderRadius: 3,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
    },
    successCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: '#EDE9FE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    innerCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        justifyContent: 'space-around',
        marginBottom: 24,
    },
    statItem: {
        alignItems: 'center',
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#E5E7EB',
    },
    nextStepsContainer: {
        width: '100%',
        backgroundColor: '#F0FDF4',
        borderRadius: 16,
        padding: 20,
    },
    nextStepsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 16,
    },
    nextStepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    nextStepNumber: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    nextStepNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    nextStepText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
        lineHeight: 20,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        gap: 12,
    },
    primaryButton: {
        backgroundColor: '#7C3AED',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#7C3AED',
        fontSize: 18,
        fontWeight: '600',
    },
});
