import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

export default function HeightScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const flatListRef = useRef<FlatList>(null);
    const [unit, setUnit] = useState<'cm' | 'inch'>('cm');
    const [height, setHeight] = useState(162);

    // Generate height values
    const cmValues = Array.from({ length: 121 }, (_, i) => 120 + i); // 120-240 cm
    const inchValues = Array.from({ length: 49 }, (_, i) => 48 + i); // 48-96 inches (4ft - 8ft)

    const heights = unit === 'cm' ? cmValues : inchValues;

    const convertHeight = (value: number, toUnit: 'cm' | 'inch') => {
        if (toUnit === 'inch') {
            return Math.round(value / 2.54);
        }
        return Math.round(value * 2.54);
    };

    const handleUnitChange = (newUnit: 'cm' | 'inch') => {
        if (newUnit !== unit) {
            const convertedHeight = convertHeight(height, newUnit);
            setHeight(convertedHeight);
            setUnit(newUnit);

            // Scroll to new value
            const newHeights = newUnit === 'cm' ? cmValues : inchValues;
            const index = newHeights.indexOf(convertedHeight);
            if (index !== -1 && flatListRef.current) {
                setTimeout(() => {
                    flatListRef.current?.scrollToIndex({ index, animated: true });
                }, 100);
            }
        }
    };

    const handleContinue = () => {
        const heightInCm = unit === 'cm' ? height : Math.round(height * 2.54);
        router.push({
            pathname: '/health-assessment/blood-type',
            params: {
                ...params,
                height: heightInCm.toString(),
                heightUnit: unit
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/blood-type',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const onScrollEnd = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        if (heights[index]) {
            setHeight(heights[index]);
        }
    };

    const formatHeight = (value: number) => {
        if (unit === 'inch') {
            const feet = Math.floor(value / 12);
            const inches = value % 12;
            return `${feet}'${inches}"`;
        }
        return value.toString();
    };

    const progress = 6 / 20;

    const renderHeightItem = ({ item }: { item: number }) => {
        const isSelected = item === height;
        return (
            <View style={[styles.heightItem, isSelected && styles.heightItemSelected]}>
                <Text style={[styles.heightText, isSelected && styles.selectedText]}>
                    {item}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
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
                <Text style={styles.title}>What is your height?</Text>

                {/* Unit Toggle */}
                <View style={styles.unitToggle}>
                    <TouchableOpacity
                        style={[styles.unitButton, unit === 'cm' && styles.unitButtonActive]}
                        onPress={() => handleUnitChange('cm')}
                    >
                        <Text style={[styles.unitText, unit === 'cm' && styles.unitTextActive]}>cm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.unitButton, unit === 'inch' && styles.unitButtonActive]}
                        onPress={() => handleUnitChange('inch')}
                    >
                        <Text style={[styles.unitText, unit === 'inch' && styles.unitTextActive]}>inch</Text>
                    </TouchableOpacity>
                </View>

                {/* Height Picker */}
                <View style={styles.pickerContainer}>
                    <View style={styles.selectionIndicator} />
                    <FlatList
                        ref={flatListRef}
                        data={heights}
                        renderItem={renderHeightItem}
                        keyExtractor={(item) => item.toString()}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        onMomentumScrollEnd={onScrollEnd}
                        contentContainerStyle={{
                            paddingVertical: ITEM_HEIGHT * 2,
                        }}
                        getItemLayout={(_, index) => ({
                            length: ITEM_HEIGHT,
                            offset: ITEM_HEIGHT * index,
                            index,
                        })}
                        initialScrollIndex={heights.indexOf(height) !== -1 ? heights.indexOf(height) : 0}
                    />
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
        marginBottom: 32,
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
    pickerContainer: {
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
        width: 120,
        position: 'relative',
    },
    selectionIndicator: {
        position: 'absolute',
        top: ITEM_HEIGHT * 2,
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        borderWidth: 2,
        borderColor: '#7C3AED',
        borderRadius: 12,
        backgroundColor: 'transparent',
        zIndex: 1,
        pointerEvents: 'none',
    },
    heightItem: {
        height: ITEM_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heightItemSelected: {
        // Selected styling handled by text
    },
    heightText: {
        fontSize: 28,
        color: '#9CA3AF',
    },
    selectedText: {
        color: '#7C3AED',
        fontWeight: '600',
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
