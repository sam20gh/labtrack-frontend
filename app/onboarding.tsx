import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
    StatusBar,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = 'hasSeenOnboarding';

interface OnboardingSlide {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    gradient: [string, string];
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        title: 'Welcome to the ultimate\nLabTrack UI Kit!',
        description: 'We\'ll help you set up your health information and get started with Lab. The testing is easy with LabTrack AI suggestions.',
        icon: 'flask-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '2',
        title: 'Personalized Health\nThat You Can Control',
        description: 'Tailored insights and plans that adapt to your unique health journey.',
        icon: 'heart-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '3',
        title: 'Daily Activity\nSuggestions',
        description: 'Simple, actionable tips to move better and feel stronger every day.',
        icon: 'fitness-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '4',
        title: 'A Health Metrics That\nUnderstands You.',
        description: 'Smart tracking that learns from your habits and evolves with you.',
        icon: 'pulse-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '5',
        title: 'Meet Dr T, An Intelligent\nHealth Companion',
        description: 'Your friendly AI guide for smarter, faster health decisions.',
        icon: 'chatbubbles-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '6',
        title: 'Access to 24/7 Virtual\nCare Anywhere.',
        description: 'Instant health support whenever—and wherever—you need it.',
        icon: 'videocam-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '7',
        title: 'Monitor Your Sleep Like\nA Baby',
        description: 'Deep sleep insights to help you wake up refreshed and recharged.',
        icon: 'moon-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '8',
        title: 'Nutrition Tracking &\nRecommendation',
        description: 'Eat smarter with personalized meal suggestions and nutrient tracking.',
        icon: 'nutrition-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '9',
        title: 'Smart Medication\nManagement',
        description: 'Timely reminders and intelligent tracking for better medication habits.',
        icon: 'medkit-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '10',
        title: 'AI-Powered Symptom\nChecker',
        description: 'Get quick, accurate insights to understand your symptoms fast.',
        icon: 'search-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '11',
        title: 'Predict Your Health With\nHigh Accuracy',
        description: 'See what\'s ahead with powerful AI-driven health predictions.',
        icon: 'analytics-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
    {
        id: '12',
        title: 'Wellness Resources,\nTips & Courses',
        description: 'Boost your mind and body with expert guides, tips, and mini-courses.',
        icon: 'book-outline',
        gradient: ['#f8f9ff', '#ffffff'],
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            flatListRef.current?.scrollToIndex({ index: currentIndex - 1 });
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleGetStarted = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            router.replace('/(auth)/loginscreen');
        } catch (error) {
            router.replace('/(auth)/loginscreen');
        }
    };

    const handleSignIn = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            router.replace('/(auth)/loginscreen');
        } catch (error) {
            router.replace('/(auth)/loginscreen');
        }
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => {
        const isFirstSlide = index === 0;
        const isLastSlide = index === slides.length - 1;

        return (
            <View style={styles.slide}>
                <LinearGradient
                    colors={item.gradient}
                    style={styles.slideGradient}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                >
                    {/* Icon/Illustration Area */}
                    <View style={styles.illustrationContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons name={item.icon} size={80} color="#7C3AED" />
                        </View>
                        {/* Decorative elements */}
                        <View style={[styles.decorCircle, styles.decorCircle1]} />
                        <View style={[styles.decorCircle, styles.decorCircle2]} />
                        <View style={[styles.decorCircle, styles.decorCircle3]} />
                    </View>

                    {/* Content Area */}
                    <View style={styles.contentContainer}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.description}>{item.description}</Text>
                    </View>

                    {/* Action Buttons */}
                    {isFirstSlide ? (
                        <View style={styles.firstSlideActions}>
                            <TouchableOpacity
                                style={styles.getStartedButton}
                                onPress={handleNext}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.getStartedText}>Get Started</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSignIn} style={styles.signInLink}>
                                <Text style={styles.signInText}>
                                    Already have an account? <Text style={styles.signInTextBold}>Sign in.</Text>
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : isLastSlide ? (
                        <View style={styles.lastSlideActions}>
                            <TouchableOpacity
                                style={styles.getStartedButton}
                                onPress={handleGetStarted}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.getStartedText}>Let's Go!</Text>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.navigationButtons}>
                            <TouchableOpacity
                                style={styles.navButton}
                                onPress={handlePrev}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-back" size={24} color="#7C3AED" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.navButton}
                                onPress={handleNext}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-forward" size={24} color="#7C3AED" />
                            </TouchableOpacity>
                        </View>
                    )}
                </LinearGradient>
            </View>
        );
    };

    const renderPagination = () => {
        return (
            <View style={styles.pagination}>
                {slides.map((_, index) => {
                    const inputRange = [
                        (index - 1) * width,
                        index * width,
                        (index + 1) * width,
                    ];

                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [8, 24, 8],
                        extrapolate: 'clamp',
                    });

                    const dotOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    width: dotWidth,
                                    opacity: dotOpacity,
                                },
                            ]}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

            <Animated.FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                scrollEventThrottle={16}
            />

            {renderPagination()}

            {/* Skip button - visible on all slides except first and last */}
            {currentIndex > 0 && currentIndex < slides.length - 1 && (
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleGetStarted}
                    activeOpacity={0.7}
                >
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9ff',
    },
    slide: {
        width,
        height,
    },
    slideGradient: {
        flex: 1,
        paddingTop: 60,
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    illustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    iconCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#EDE9FE',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    decorCircle: {
        position: 'absolute',
        borderRadius: 100,
        backgroundColor: '#7C3AED',
    },
    decorCircle1: {
        width: 12,
        height: 12,
        top: '20%',
        left: '15%',
        opacity: 0.3,
    },
    decorCircle2: {
        width: 8,
        height: 8,
        top: '30%',
        right: '20%',
        opacity: 0.5,
    },
    decorCircle3: {
        width: 16,
        height: 16,
        bottom: '25%',
        right: '25%',
        opacity: 0.2,
    },
    contentContainer: {
        paddingVertical: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a2e',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 36,
    },
    description: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 16,
    },
    firstSlideActions: {
        alignItems: 'center',
        paddingTop: 20,
    },
    lastSlideActions: {
        alignItems: 'center',
        paddingTop: 20,
    },
    getStartedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7C3AED',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        gap: 8,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    getStartedText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    signInLink: {
        marginTop: 20,
    },
    signInText: {
        fontSize: 14,
        color: '#666',
    },
    signInTextBold: {
        color: '#7C3AED',
        fontWeight: '600',
    },
    navigationButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 40,
        paddingTop: 20,
    },
    navButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#EDE9FE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    pagination: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#7C3AED',
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: 24,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    skipText: {
        fontSize: 16,
        color: '#7C3AED',
        fontWeight: '500',
    },
});
