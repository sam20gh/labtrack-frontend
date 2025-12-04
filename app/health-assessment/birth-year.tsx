import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');
const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

// Generate years from 1940 to current year
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1940 + 1 }, (_, i) => currentYear - i);

export default function BirthYearScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const flatListRef = useRef<FlatList>(null);
    const [selectedYear, setSelectedYear] = useState(2001);
    const [selectedMonth, setSelectedMonth] = useState(8);

    const months = [
        { num: 1, label: 'January' },
        { num: 2, label: 'February' },
        { num: 3, label: 'March' },
        { num: 4, label: 'April' },
        { num: 5, label: 'May' },
        { num: 6, label: 'June' },
        { num: 7, label: 'July' },
        { num: 8, label: 'August' },
        { num: 9, label: 'September' },
        { num: 10, label: 'October' },
        { num: 11, label: 'November' },
        { num: 12, label: 'December' },
    ];

    useEffect(() => {
        // Scroll to default year (2001)
        const index = years.indexOf(2001);
        if (index !== -1 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index, animated: false });
            }, 100);
        }
    }, []);

    const calculateAge = () => {
        const today = new Date();
        let age = today.getFullYear() - selectedYear;
        if (today.getMonth() + 1 < selectedMonth) {
            age--;
        }
        return age;
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/gender',
            params: {
                ...params,
                birthYear: selectedYear.toString(),
                birthMonth: selectedMonth.toString()
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/gender',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const onScrollEnd = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        if (years[index]) {
            setSelectedYear(years[index]);
        }
    };

    const progress = 3 / 20;

    const renderYearItem = ({ item, index }: { item: number; index: number }) => {
        const isSelected = item === selectedYear;
        return (
            <View style={[styles.yearItem, isSelected && styles.yearItemSelected]}>
                <Text style={[styles.monthText, isSelected && styles.selectedText]}>
                    {String(index + 1).padStart(2, '0')}
                </Text>
                <Text style={[styles.yearText, isSelected && styles.selectedText]}>
                    {item}
                </Text>
            </View>
        );
    };

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
                <Text style={styles.title}>When were you born?</Text>

                {/* Year Picker */}
                <View style={styles.pickerContainer}>
                    <View style={styles.selectionIndicator} />
                    <FlatList
                        ref={flatListRef}
                        data={years}
                        renderItem={renderYearItem}
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
                    />
                </View>

                {/* Age Display */}
                <Text style={styles.ageText}>I'm {calculateAge()} years of age</Text>
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
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 20,
        marginBottom: 40,
    },
    pickerContainer: {
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
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
    yearItem: {
        height: ITEM_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    yearItemSelected: {
        // Selected styling handled by text
    },
    monthText: {
        fontSize: 18,
        color: '#9CA3AF',
        marginRight: 16,
    },
    yearText: {
        fontSize: 18,
        color: '#9CA3AF',
    },
    selectedText: {
        color: '#7C3AED',
        fontWeight: '600',
    },
    ageText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'left',
        marginTop: 24,
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
