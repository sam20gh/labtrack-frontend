import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';

const { width } = Dimensions.get('window');

export default function CompleteScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [isSaving, setIsSaving] = useState(true);
    const [saveError, setSaveError] = useState<string | null>(null);
    const hasSaved = useRef(false);

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

    // Helper to parse array params (they come as comma-separated strings or arrays)
    const parseArrayParam = (param: any): string[] => {
        if (!param) return [];
        if (Array.isArray(param)) return param;
        if (typeof param === 'string') {
            // Try to parse as JSON first
            try {
                const parsed = JSON.parse(param);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                // If not JSON, split by comma
                return param.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        return [];
    };

    // Save health assessment data to the backend
    const saveHealthAssessment = async () => {
        if (hasSaved.current) return;
        hasSaved.current = true;

        try {
            const userId = await AsyncStorage.getItem('userId');
            const token = await AsyncStorage.getItem('authToken');

            if (!userId || !token) {
                setSaveError('Please log in to save your health assessment');
                setIsSaving(false);
                return;
            }

            // Extract all params from the health assessment flow
            const {
                // Basic info
                fullName,
                healthGoals,
                birthYear,
                // Physical attributes
                gender,
                weight,
                weightUnit,
                height,
                heightUnit,
                bloodType,
                rhFactor,
                fitnessLevel,
                // Lifestyle
                sleepLevel,
                sleepHours,
                exerciseTypes,
                mood,
                eatingHabits,
                calorieIntake,
                // Medical
                hasMedications,
                medications,
                hasAllergies,
                allergies,
                hasConditions,
                conditions,
                checkupFrequency,
                // Notes & Voice
                healthNotes,
                hasVoiceRecording,
                voiceDuration,
            } = params;

            // Parse name
            const nameParts = fullName ? String(fullName).split(' ') : [];
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Calculate DOB from birth year
            const dob = birthYear ? `${birthYear}-01-01` : '';

            // Parse numeric values
            const parsedWeight = weight ? parseFloat(String(weight)) : null;
            const parsedHeight = height ? parseFloat(String(height)) : null;
            const parsedCalories = calorieIntake && calorieIntake !== 'unknown' ? parseInt(String(calorieIntake)) : null;

            // Build the health assessment object
            const healthAssessment: any = {
                // Goals
                healthGoals: parseArrayParam(healthGoals),

                // Lifestyle
                lifestyle: {
                    fitnessLevel: fitnessLevel ? String(fitnessLevel) : undefined,
                    sleepQuality: sleepLevel ? parseInt(String(sleepLevel)) : undefined,
                    sleepHoursPerNight: sleepHours ? parseFloat(String(sleepHours)) : undefined,
                    exerciseTypes: parseArrayParam(exerciseTypes),
                    dietType: eatingHabits ? String(eatingHabits) : undefined,
                    checkupFrequency: checkupFrequency ? String(checkupFrequency) : undefined,
                },

                // Mood entry (if provided)
                moodHistory: mood ? [{
                    mood: String(mood),
                    date: new Date(),
                }] : [],

                // Nutrition
                nutritionGoals: parsedCalories ? {
                    dailyCalorieGoal: parsedCalories,
                } : undefined,

                // Medical info
                medications: hasMedications === 'true' ? parseArrayParam(medications).map(med => ({
                    name: med,
                    isCurrentlyTaking: true,
                })) : [],

                allergies: hasAllergies === 'true' ? parseArrayParam(allergies).map(allergy => ({
                    allergen: allergy,
                    severity: 'Moderate',
                })) : [],

                conditions: hasConditions === 'true' ? parseArrayParam(conditions).map(condition => ({
                    name: condition,
                    status: 'Active',
                })) : [],

                // Notes
                notes: healthNotes ? [{
                    content: String(healthNotes),
                    category: 'General',
                    createdAt: new Date(),
                }] : [],

                // Analysis preferences
                analysisPreferences: {
                    receiveAIRecommendations: true,
                    focusAreas: parseArrayParam(healthGoals),
                },
            };

            // Update user profile fields (name, dob, gender, height, weight)
            const userProfileUpdate: any = {};
            if (firstName) userProfileUpdate.firstName = firstName;
            if (lastName) userProfileUpdate.lastName = lastName;
            if (dob) userProfileUpdate.dob = dob;
            if (gender) userProfileUpdate.gender = String(gender);
            if (parsedHeight !== null) userProfileUpdate.height = parsedHeight;
            if (parsedWeight !== null) userProfileUpdate.weight = parsedWeight;
            if (bloodType) userProfileUpdate.bloodType = `${bloodType}${rhFactor || ''}`;

            // First, update user profile
            if (Object.keys(userProfileUpdate).length > 0) {
                const profileResponse = await fetch(`${API_URL}/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(userProfileUpdate),
                });

                if (!profileResponse.ok) {
                    console.warn('Failed to update user profile:', await profileResponse.text());
                }
            }

            // Then, update health assessment
            const assessmentResponse = await fetch(`${API_URL}/users/${userId}/health-assessment`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ healthAssessment }),
            });

            if (!assessmentResponse.ok) {
                const errorData = await assessmentResponse.text();
                throw new Error(`Failed to save health assessment: ${errorData}`);
            }

            console.log('Health assessment saved successfully!');
            setIsSaving(false);
            startAnimations();

        } catch (error) {
            console.error('Error saving health assessment:', error);
            setSaveError(error instanceof Error ? error.message : 'Failed to save health assessment');
            setIsSaving(false);
            startAnimations();
        }
    };

    const startAnimations = () => {
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
    };

    useEffect(() => {
        saveHealthAssessment();
    }, []);

    const handleGoToHome = () => {
        // Navigate to home/tabs and reset the stack
        router.replace('/(tabs)');
    };

    const handleViewProfile = () => {
        router.replace('/(tabs)/ProfileScreen');
    };

    const confettiColors = ['#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

    // Show loading state while saving
    if (isSaving) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.screenTitle}>Health Assessment</Text>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                    <Text style={styles.loadingText}>Saving your health profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Screen Title */}
            <Text style={styles.screenTitle}>Health Assessment</Text>

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
                        {saveError 
                            ? `Your assessment was completed but there was an issue saving: ${saveError}. You can try again from your profile.`
                            : "Great job! Your health profile has been created. We'll use this information to provide personalized insights and recommendations."
                        }
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
    screenTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7C3AED',
        textAlign: 'center',
        paddingTop: 8,
        marginBottom: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 12,
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
