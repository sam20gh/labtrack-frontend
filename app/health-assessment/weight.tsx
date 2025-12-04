import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');

export default function WeightScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
    const [weight, setWeight] = useState(140);

    const minWeight = unit === 'lbs' ? 66 : 30;
    const maxWeight = unit === 'lbs' ? 440 : 200;

    const convertWeight = (value: number, toUnit: 'lbs' | 'kg') => {
        if (toUnit === 'kg') {
            return Math.round(value * 0.453592);
        }
        return Math.round(value / 0.453592);
    };

    const handleUnitChange = (newUnit: 'lbs' | 'kg') => {
        if (newUnit !== unit) {
            const convertedWeight = convertWeight(weight, newUnit);
            setWeight(convertedWeight);
            setUnit(newUnit);
        }
    };

    const handleContinue = () => {
        const weightInKg = unit === 'kg' ? weight : Math.round(weight * 0.453592);
        router.push({
            pathname: '/health-assessment/height',
            params: {
                ...params,
                weight: weightInKg.toString(),
                weightUnit: unit
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/height',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 5 / 20;

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Screen Title */}
            <Text style={styles.screenTitle}>Health Assessment</Text>
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                </View>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text style={styles.title}>What is your weight?</Text>

                {/* Unit Toggle */}
                <View style={styles.unitToggle}>
                    <TouchableOpacity
                        style={[styles.unitButton, unit === 'lbs' && styles.unitButtonActive]}
                        onPress={() => handleUnitChange('lbs')}
                    >
                        <Text style={[styles.unitText, unit === 'lbs' && styles.unitTextActive]}>lbs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.unitButton, unit === 'kg' && styles.unitButtonActive]}
                        onPress={() => handleUnitChange('kg')}
                    >
                        <Text style={[styles.unitText, unit === 'kg' && styles.unitTextActive]}>kg</Text>
                    </TouchableOpacity>
                </View>

                {/* Weight Display */}
                <View style={styles.weightDisplay}>
                    <Text style={styles.weightValue}>{weight}</Text>
                    <Text style={styles.weightUnit}>{unit}</Text>
                </View>

                {/* Slider */}
                <View style={styles.sliderContainer}>
                    <View style={styles.sliderTrack}>
                        <Slider
                            style={styles.slider}
                            minimumValue={minWeight}
                            maximumValue={maxWeight}
                            value={weight}
                            onValueChange={(value) => setWeight(Math.round(value))}
                            minimumTrackTintColor="#7C3AED"
                            maximumTrackTintColor="#E5E7EB"
                            thumbTintColor="#7C3AED"
                        />
                    </View>
                    {/* Scale markers */}
                    <View style={styles.scaleMarkers}>
                        <Text style={styles.scaleText}>{unit === 'lbs' ? '120' : '55'}</Text>
                        <Text style={styles.scaleText}>{unit === 'lbs' ? '130' : '60'}</Text>
                        <Text style={styles.scaleText}>{unit === 'lbs' ? '150' : '70'}</Text>
                        <Text style={styles.scaleText}>{unit === 'lbs' ? '180' : '80'}</Text>
                    </View>
                </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    screenTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'center',
        paddingVertical: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 4,
    },
    progressBarContainer: {
        flex: 1,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginHorizontal: 16,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#7C3AED',
        borderRadius: 2,
    },
    skipText: {
        color: '#7C3AED',
        fontSize: 16,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 32,
    },
    unitToggle: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
        marginBottom: 48,
    },
    unitButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 10,
    },
    unitButtonActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    unitText: {
        fontSize: 15,
        color: '#6B7280',
        fontWeight: '500',
    },
    unitTextActive: {
        color: '#1F2937',
    },
    weightDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 48,
    },
    weightValue: {
        fontSize: 72,
        fontWeight: '300',
        color: '#1F2937',
    },
    weightUnit: {
        fontSize: 24,
        color: '#6B7280',
        marginLeft: 8,
    },
    sliderContainer: {
        width: '100%',
        paddingHorizontal: 10,
    },
    sliderTrack: {
        width: '100%',
    },
    slider: {
        width: '100%',
        height: 40,
    },
    scaleMarkers: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        marginTop: 8,
    },
    scaleText: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    continueButton: {
        backgroundColor: '#7C3AED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
});
