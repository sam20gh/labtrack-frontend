/**
 * Onboarding carousel.
 *
 * Laid out from the turing kit's welcome screens. Two slide shapes:
 *
 * - **Slide 1** is the welcome: line-art hero, headline, and a full-width primary CTA with
 *   a sign-in escape hatch underneath, for people who already have an account and should
 *   not have to swipe through eleven feature slides to reach it.
 * - **Slides 2-12** are feature slides: a segmented progress bar, a lavender stage with a
 *   phone body rising from the bottom and the feature's card floating over its top edge,
 *   then a white sheet carrying the copy and the prev/next controls.
 *
 * The card artwork lives in `components/onboarding/SlideVisuals.tsx` — see the note there
 * about the two slides the kit illustrates with stock photography.
 */
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import SlideVisual from '@/components/onboarding/SlideVisuals';
import WelcomeIllustration from '@/components/onboarding/WelcomeIllustration';
import { Fonts, Palette } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = 'hasSeenOnboarding';

interface OnboardingSlide {
    id: string;
    title: string;
    description: string;
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        title: 'Welcome to the ultimate\nLabTrack UI Kit!',
        description: 'We bring all of your health information together on one app, with the power of AI',
    },
    {
        id: '2',
        title: 'Personalized Health\nThat You Can Control',
        description: 'Tailored insights and plans that adapt to your unique health journey.',
    },
    {
        id: '3',
        title: 'Daily Activity\nSuggestions',
        description: 'Simple, actionable tips to move better and feel stronger every day.',
    },
    {
        id: '4',
        title: 'A Health Metrics That\nUnderstands You.',
        description: 'Smart tracking that learns from your habits and evolves with you.',
    },
    {
        id: '5',
        title: 'Meet Dr T, An Intelligent\nHealth Companion',
        description: 'Your friendly AI guide for smarter, faster health decisions.',
    },
    {
        id: '6',
        title: 'Access to 24/7 Virtual\nCare Anywhere.',
        description: 'Instant health support whenever—and wherever—you need it.',
    },
    {
        id: '7',
        title: 'Monitor Your Sleep Like\nA Baby',
        description: 'Deep sleep insights to help you wake up refreshed and recharged.',
    },
    {
        id: '8',
        title: 'Nutrition Tracking &\nRecommendation',
        description: 'Eat smarter with personalized meal suggestions and nutrient tracking.',
    },
    {
        id: '9',
        title: 'Smart Medication\nManagement',
        description: 'Timely reminders and intelligent tracking for better medication habits.',
    },
    {
        id: '10',
        title: 'AI-Powered Symptom\nChecker',
        description: 'Get quick, accurate insights to understand your symptoms fast.',
    },
    {
        id: '11',
        title: 'Predict Your Health With\nHigh Accuracy',
        description: 'See what\'s ahead with powerful AI-driven health predictions.',
    },
    {
        id: '12',
        title: 'Wellness Resources,\nTips & Courses',
        description: 'Boost your mind and body with expert guides, tips, and mini-courses.',
    },
];

/** One segment per feature slide — slide 1 is the cover, so it sits outside the count. */
const FEATURE_COUNT = slides.length - 1;

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

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

    const handleSignIn = handleGetStarted;

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    /** Slide 1: the cover. No progress bar — nothing has been progressed through yet. */
    const renderWelcome = (item: OnboardingSlide) => (
        <SafeAreaView style={styles.welcome} edges={['top', 'bottom']}>
            <View style={styles.welcomeArt}>
                <WelcomeIllustration width={Math.min(width - 48, 340)} />
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color={Palette.white} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSignIn} style={styles.signInLink} activeOpacity={0.7}>
                <Text style={styles.signInText}>
                    Already have an account? <Text style={styles.signInTextBold}>Sign In.</Text>
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );

    /** Slides 2-12: stage above, copy sheet below. */
    const renderFeature = (item: OnboardingSlide, index: number) => {
        const isLast = index === slides.length - 1;

        return (
            <View style={styles.feature}>
                <SafeAreaView edges={['top']} style={styles.progressWrap}>
                    <View style={styles.progress}>
                        {Array.from({ length: FEATURE_COUNT }).map((_, i) => (
                            <View
                                key={i}
                                style={[styles.progressSegment, i < index && styles.progressSegmentFilled]}
                            />
                        ))}
                    </View>
                </SafeAreaView>

                <View style={styles.stage}>
                    <LinearGradient
                        colors={[Palette.white, Palette.white, '#E7DBFA']}
                        locations={[0, 0.5, 1]}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Phone body. It runs past the bottom of the stage on purpose — the
                        copy sheet crops it, which is what gives the card its lift. */}
                    <View style={styles.phone}>
                        <View style={styles.phoneScreen}>
                            <View style={styles.dynamicIsland}>
                                <View style={styles.islandCamera} />
                            </View>
                        </View>
                    </View>

                    <View style={styles.cardLayer}>
                        <SlideVisual id={item.id} />
                    </View>
                </View>

                <SafeAreaView edges={['bottom']} style={styles.sheet}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>

                    <View style={styles.navRow}>
                        <TouchableOpacity style={styles.navButton} onPress={handlePrev} activeOpacity={0.7}>
                            <Ionicons name="chevron-back" size={20} color={Palette.primary} />
                        </TouchableOpacity>

                        {isLast ? (
                            <TouchableOpacity
                                style={styles.finishButton}
                                onPress={handleGetStarted}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.finishButtonText}>Let&apos;s Go!</Text>
                                <Ionicons name="checkmark" size={18} color={Palette.white} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.navButton} onPress={handleNext} activeOpacity={0.7}>
                                <Ionicons name="chevron-forward" size={20} color={Palette.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </SafeAreaView>
            </View>
        );
    };

    const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
        <View style={styles.slide}>
            {index === 0 ? renderWelcome(item) : renderFeature(item, index)}
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={Palette.white} />

            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}

            />

            {/* Skip is for people mid-tour. On the cover the CTA already says "Get Started",
                and on the last slide "Let's Go!" does the same job. */}
            {currentIndex > 0 && currentIndex < slides.length - 1 && (
                <SafeAreaView edges={['top']} style={styles.skipWrap} pointerEvents="box-none">
                    <TouchableOpacity style={styles.skipButton} onPress={handleGetStarted} activeOpacity={0.7}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Palette.white,
    },
    slide: {
        width,
        height,
        backgroundColor: Palette.white,
    },

    // shared copy
    title: {
        fontSize: 26,
        fontFamily: Fonts.bold,
        color: Palette.text,
        textAlign: 'center',
        lineHeight: 34,
        paddingHorizontal: 24,
    },
    description: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginTop: 12,
        paddingHorizontal: 32,
    },

    // slide 1
    welcome: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: 24,
    },
    welcomeArt: {
        alignItems: 'center',
        marginBottom: 44,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: Palette.primary,
        marginHorizontal: 24,
        marginTop: 36,
        paddingVertical: 17,
        borderRadius: 14,
        shadowColor: Palette.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 8,
    },
    primaryButtonText: {
        color: Palette.white,
        fontSize: 16,
        fontFamily: Fonts.semibold,
    },
    signInLink: {
        marginTop: 22,
        alignItems: 'center',
    },
    signInText: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    signInTextBold: {
        fontFamily: Fonts.bold,
        color: Palette.primary,
        textDecorationLine: 'underline',
    },

    // slides 2-12
    feature: {
        flex: 1,
    },
    progressWrap: {
        backgroundColor: Palette.white,
    },
    progress: {
        flexDirection: 'row',
        gap: 5,
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 6,
    },
    progressSegment: {
        flex: 1,
        height: 5,
        borderRadius: 3,
        backgroundColor: Palette.borderLight,
    },
    progressSegmentFilled: {
        backgroundColor: Palette.primary,
    },
    stage: {
        flex: 1,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    phone: {
        position: 'absolute',
        left: 46,
        right: 46,
        top: 52,
        bottom: -60,
        borderRadius: 46,
        borderWidth: 3,
        borderColor: '#EDEFF3',
        backgroundColor: '#FBFBFD',
        padding: 6,
    },
    phoneScreen: {
        flex: 1,
        borderRadius: 40,
        backgroundColor: '#F5F6F9',
        alignItems: 'center',
        paddingTop: 14,
    },
    dynamicIsland: {
        width: 92,
        height: 26,
        borderRadius: 13,
        backgroundColor: Palette.white,
        borderWidth: 1,
        borderColor: '#E8EAEF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
    },
    islandCamera: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#C7CBD3',
    },
    cardLayer: {
        paddingHorizontal: 18,
        justifyContent: 'center',
    },
    sheet: {
        backgroundColor: Palette.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 28,
        paddingBottom: 16,
        marginTop: -20,
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        marginTop: 24,
        marginBottom: 12,
    },
    navButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    finishButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Palette.primary,
        paddingHorizontal: 26,
        height: 52,
        borderRadius: 26,
        shadowColor: Palette.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
        elevation: 6,
    },
    finishButtonText: {
        color: Palette.white,
        fontSize: 15,
        fontFamily: Fonts.semibold,
    },

    skipWrap: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
    skipButton: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        marginTop: 6,
    },
    skipText: {
        fontSize: 14,
        fontFamily: Fonts.semibold,
        color: Palette.primary,
    },
});
