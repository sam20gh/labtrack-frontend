import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import StateView from '@/components/errors/StateView';

import { makeStyles } from '@/hooks/useTheme';
import { describeState } from '@/lib/appState';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { tone } from '@/constants/theme';

interface TestDetailsProps {
    patient: {
        user_id: string;
        name: string;
        age: number;
        gender: string;
        date_of_test: string;
        lab_name: string;
        test_type: string;
    };
    results: {
        [key: string]: {
            value: number;
            unit: string;
            reference_range: string;
            status: string;
        };
    };
    interpretation: string;
}

const TestDetails: React.FC = () => {
    const styles = useStyles();
    const route = useRoute();
    const router = useRouter();
    const { test } = (route.params ?? {}) as { test?: TestDetailsProps };

    // Reached by navigating here without the `test` param — a stale deep link, or a back
    // navigation after the result was deleted. It is the same fact as a 404, so it is drawn
    // as one rather than as a red line on an otherwise empty screen.
    if (!test) {
        return (
            <SafeAreaView style={styles.missing} edges={['top', 'bottom']}>
                <StateView
                    state={describeState('not_found', {
                        title: 'Result Not Found',
                        body: 'We could not open this result. It may have been removed, or the link may be out of date.',
                        badge: 'Error Code: 404',
                    })}
                    primary={{ label: 'Back to Results', icon: 'arrow-back-outline', onPress: () => router.back() }}
                    secondary={{ label: 'Contact Support', icon: 'chatbubble-ellipses-outline', onPress: () => router.push('/help') }}
                />
            </SafeAreaView>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.card}>
                <View style={styles.headerRow}>
                    <Icon name="flask-outline" size={26} color={tone('#6200EA')} />
                    <Text style={styles.testType}>{test.patient.test_type}</Text>
                </View>
                <Text style={styles.labInfo}><Icon name="hospital" size={18} color={tone('#666666')} /> Lab: {test.patient.lab_name}</Text>
                <Text style={styles.testDate}><Icon name="calendar" size={18} color={tone('#666666')} /> Date: {test.patient.date_of_test}</Text>
                <Text style={styles.interpretation}>{test.interpretation}</Text>
            </View>

            <Text style={styles.sectionTitle}>Test Results</Text>
            <View style={styles.resultsContainer}>
                {Object.entries(test.results).map(([key, value], index) => (
                    <View key={index} style={styles.resultItem}>
                        <Icon name="test-tube" size={22} color={tone('#6200EA')} style={styles.resultIcon} />
                        <View style={styles.resultTextContainer}>
                            <Text style={styles.resultText}>{key}</Text>
                            <Text style={styles.resultValue}>{value.value} {value.unit}</Text>
                            <Text style={styles.referenceRange}>Reference: {value.reference_range}</Text>
                            <Text style={[styles.status, statusStyle(styles, value.status)]}>{value.status}</Text>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const useStyles = makeStyles((Palette) => ({
    container: { flex: 1, padding: 10, backgroundColor: Palette.canvas },
    missing: { flex: 1, backgroundColor: Palette.background },
    card: { padding: 15, marginBottom: 16, borderRadius: 10, backgroundColor: Palette.background, elevation: 3 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    testType: { fontSize: 20, fontWeight: 'bold', marginLeft: 8, color: Palette.text },
    labInfo: { fontSize: 16, color: Palette.textSecondary, marginVertical: 3 },
    testDate: { fontSize: 16, color: Palette.textMuted, marginVertical: 3 },
    interpretation: { fontSize: 14, fontStyle: 'italic', marginTop: 5, color: Palette.text },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginVertical: 10, color: Palette.text, textAlign: 'center' },
    resultsContainer: { marginTop: 10 },
    resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.background, padding: 12, marginVertical: 6, borderRadius: 8, elevation: 2 },
    resultIcon: { marginRight: 10 },
    resultTextContainer: { flex: 1 },
    resultText: { fontSize: 16, fontWeight: 'bold', color: Palette.text },
    resultValue: { fontSize: 14, fontWeight: 'bold', color: Palette.text },
    referenceRange: { fontSize: 12, fontStyle: 'italic', color: Palette.textSecondary },
    status: { fontSize: 14, fontWeight: 'bold', marginTop: 3 },
    normal: { color: Palette.success },
    high: { color: Palette.danger },
    low: { color: Palette.info }
}));

/** Colour a result by its reported status; unknown statuses fall back to neutral. */
const statusStyle = (styles: object, status?: string) => {
    const key = String(status ?? '').toLowerCase();
    const map = styles as Record<string, object>;
    return map[key] ?? null;
};

export default TestDetails;
