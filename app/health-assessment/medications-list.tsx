import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const commonMedications = [
    'Aspirin',
    'Amoxicillin',
    'Atorvastatin',
    'Albuterol',
    'Acetaminophen',
    'Amitriptyline',
    'Amlodipine',
    'Amlodipine XL',
    'Amlodipine XX',
    'Azithromycin',
    'Benzonatate',
    'Buspirone',
    'Cephalexin',
    'Ciprofloxacin',
    'Citalopram',
    'Clonazepam',
    'Cyclobenzaprine',
    'Doxycycline',
    'Duloxetine',
    'Escitalopram',
    'Fluoxetine',
    'Gabapentin',
    'Hydrochlorothiazide',
    'Ibuprofen',
    'Levothyroxine',
    'Lisinopril',
    'Loratadine',
    'Losartan',
    'Metformin',
    'Metoprolol',
    'Montelukast',
    'Naproxen',
    'Omeprazole',
    'Ondansetron',
    'Pantoprazole',
    'Prednisone',
    'Sertraline',
    'Simvastatin',
    'Tramadol',
    'Trazodone',
];

export default function MedicationsListScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMedications, setSelectedMedications] = useState<string[]>([]);

    const filteredMedications = useMemo(() => {
        if (!searchQuery.trim()) return commonMedications.slice(0, 10);
        return commonMedications.filter(med =>
            med.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery]);

    const toggleMedication = (medication: string) => {
        setSelectedMedications(prev =>
            prev.includes(medication)
                ? prev.filter(m => m !== medication)
                : [...prev, medication]
        );
    };

    const removeMedication = (medication: string) => {
        setSelectedMedications(prev => prev.filter(m => m !== medication));
    };

    const handleContinue = () => {
        router.push({
            pathname: '/health-assessment/allergies',
            params: {
                ...params,
                medications: selectedMedications.join(',')
            }
        });
    };

    const handleSkip = () => {
        router.push({
            pathname: '/health-assessment/allergies',
            params: { ...params }
        });
    };

    const handleBack = () => {
        router.back();
    };

    const progress = 14 / 20;

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
                <Text style={styles.title}>Please specify your medications, then.</Text>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search medication..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* Results count */}
                {searchQuery.length > 0 && (
                    <Text style={styles.resultsCount}>
                        {filteredMedications.length} result(s) found.
                    </Text>
                )}

                {/* Medication List */}
                <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                    {filteredMedications.length > 0 ? (
                        filteredMedications.map((medication) => {
                            const isSelected = selectedMedications.includes(medication);
                            return (
                                <TouchableOpacity
                                    key={medication}
                                    style={[styles.medicationItem, isSelected && styles.medicationItemSelected]}
                                    onPress={() => toggleMedication(medication)}
                                >
                                    <Text style={[styles.medicationText, isSelected && styles.medicationTextSelected]}>
                                        {medication}
                                    </Text>
                                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.notFoundContainer}>
                            <View style={styles.notFoundIcon}>
                                <Ionicons name="close-circle" size={48} color="#EF4444" />
                            </View>
                            <Text style={styles.notFoundTitle}>Whoops! not found.</Text>
                            <Text style={styles.notFoundText}>
                                We couldn't find "{searchQuery}". Please try another keyword.
                            </Text>
                        </View>
                    )}
                </ScrollView>

                {/* Selected Medications */}
                {selectedMedications.length > 0 && (
                    <View style={styles.selectedContainer}>
                        <Text style={styles.selectedLabel}>Selected:</Text>
                        <View style={styles.chipsContainer}>
                            {selectedMedications.map((medication) => (
                                <View key={medication} style={styles.chip}>
                                    <Text style={styles.chipText}>{medication}</Text>
                                    <TouchableOpacity onPress={() => removeMedication(medication)}>
                                        <Ionicons name="close" size={16} color="#6B7280" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
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
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 24,
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
    resultsCount: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 12,
    },
    listContainer: {
        flex: 1,
    },
    medicationItem: {
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
    medicationItemSelected: {
        borderColor: '#7C3AED',
        backgroundColor: '#FAF5FF',
    },
    medicationText: {
        fontSize: 15,
        color: '#4B5563',
    },
    medicationTextSelected: {
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
    notFoundContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    notFoundIcon: {
        marginBottom: 16,
    },
    notFoundTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
    },
    notFoundText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
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
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingVertical: 6,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 20,
    },
    chipText: {
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
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
});
