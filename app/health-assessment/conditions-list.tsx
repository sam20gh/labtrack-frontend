import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const commonConditions = [
    'Hypertension',
    'Asthma',
    'Allergies',
    'Arthritis',
    'Obesity',
    'Depression',
    'Chronic Pain',
    'Diabetes',
    'Anemia',
    'Anxiety Disorders',
    'Acne',
    'Acid Reflux',
    'ADHD',
    'Alzheimer\'s Disease',
    'Bipolar Disorder',
    'Cancer',
    'Celiac Disease',
    'COPD',
    'Crohn\'s Disease',
    'Eczema',
    'Epilepsy',
    'Fibromyalgia',
    'GERD',
    'Heart Disease',
    'Hepatitis',
    'High Cholesterol',
    'HIV/AIDS',
    'Hypothyroidism',
    'IBS',
    'Insomnia',
    'Kidney Disease',
    'Lupus',
    'Migraine',
    'Multiple Sclerosis',
    'Osteoporosis',
    'Parkinson\'s Disease',
    'PCOS',
    'Psoriasis',
    'Rheumatoid Arthritis',
    'Schizophrenia',
    'Sleep Apnea',
    'Stroke',
    'Thyroid Disorders',
    'Ulcerative Colitis',
];

const mostCommon = ['Hypertension', 'Asthma', 'Allergies', 'Arthritis', 'Obesity', 'Depression', 'Chronic Pain', 'Diabetes'];

export default function ConditionsListScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
    const [showSearch, setShowSearch] = useState(false);

    const filteredConditions = useMemo(() => {
        if (!searchQuery.trim()) return commonConditions.slice(0, 10);
        return commonConditions.filter(condition =>
            condition.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const toggleCondition = (condition: string) => {
        setSelectedConditions(prev =>
            prev.includes(condition)
                ? prev.filter(c => c !== condition)
                : [...prev, condition]
        );
    };

    const removeCondition = (condition: string) => {
        setSelectedConditions(prev => prev.filter(c => c !== condition));
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/checkup-frequency',
            params: {
                ...params,
                conditions: selectedConditions.join(',')
            }
        });
    };

    const handleNone = () => {
        router.push({
            pathname: '/health-assessment/checkup-frequency',
            params: {
                ...params,
                conditions: ''
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/checkup-frequency',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 16 / 20;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <Text style={styles.screenTitle}>Health Assessment</Text>
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
                <Text style={styles.title}>Please specify your medical condition</Text>

                {/* Most Common Section */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Most Common</Text>
                    <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
                        <View style={styles.searchButton}>
                            <Ionicons name="search" size={16} color="#7C3AED" />
                            <Text style={styles.searchButtonText}>Search</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Search Input (conditional) */}
                {showSearch && (
                    <View style={styles.searchContainer}>
                        <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search medical condition..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                    </View>
                )}

                {/* Condition chips for most common */}
                {!showSearch && (
                    <View style={styles.commonChipsContainer}>
                        {mostCommon.map((condition) => {
                            const isSelected = selectedConditions.includes(condition);
                            return (
                                <TouchableOpacity
                                    key={condition}
                                    style={[styles.commonChip, isSelected && styles.commonChipSelected]}
                                    onPress={() => toggleCondition(condition)}
                                >
                                    <Text style={[styles.commonChipText, isSelected && styles.commonChipTextSelected]}>
                                        {condition}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Search Results List */}
                {showSearch && (
                    <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                        {filteredConditions.map((condition) => {
                            const isSelected = selectedConditions.includes(condition);
                            return (
                                <TouchableOpacity
                                    key={condition}
                                    style={[styles.conditionItem, isSelected && styles.conditionItemSelected]}
                                    onPress={() => toggleCondition(condition)}
                                >
                                    <Text style={[styles.conditionText, isSelected && styles.conditionTextSelected]}>
                                        {condition}
                                    </Text>
                                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Selected Conditions */}
                {selectedConditions.length > 0 && (
                    <View style={styles.selectedContainer}>
                        <Text style={styles.selectedLabel}>Selected:</Text>
                        <View style={styles.selectedChipsContainer}>
                            {selectedConditions.map((condition) => (
                                <View key={condition} style={styles.selectedChip}>
                                    <Text style={styles.selectedChipText}>{condition}</Text>
                                    <TouchableOpacity onPress={() => removeCondition(condition)}>
                                        <Ionicons name="close" size={16} color="#6B7280" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>

            {/* Bottom Buttons */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.noneButton} onPress={handleNone}>
                    <Ionicons name="close" size={16} color="#6B7280" />
                    <Text style={styles.noneButtonText}>I don't have any</Text>
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
        fontSize: 14,
        fontWeight: '600',
        color: '#7C3AED',
        textAlign: 'center',
        paddingTop: 8,
        marginBottom: 8,
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
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#6B7280',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchButtonText: {
        color: '#7C3AED',
        fontSize: 14,
        marginLeft: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        marginLeft: 12,
    },
    commonChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 24,
    },
    commonChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
    },
    commonChipSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#7C3AED',
    },
    commonChipText: {
        fontSize: 14,
        color: '#4B5563',
    },
    commonChipTextSelected: {
        color: '#fff',
    },
    listContainer: {
        flex: 1,
    },
    conditionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    conditionItemSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    conditionText: {
        fontSize: 15,
        color: '#4B5563',
    },
    conditionTextSelected: {
        color: '#7C3AED',
        fontWeight: '500',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#7C3AED',
        borderColor: '#7C3AED',
    },
    selectedContainer: {
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    selectedLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 8,
    },
    selectedChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 20,
    },
    selectedChipText: {
        fontSize: 13,
        color: '#4B5563',
        marginRight: 6,
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
        marginBottom: 12,
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    noneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
    },
    noneButtonText: {
        fontSize: 15,
        color: '#6B7280',
        marginLeft: 8,
    },
});
