import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList } from 'react-native';
import { Title, Paragraph, ActivityIndicator, Card, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import Toast from 'react-native-toast-message';

const MyPlansScreen = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                const userId = await AsyncStorage.getItem('userId');

                if (!token || !userId) {
                    Toast.show({ type: 'error', text1: 'Error', text2: 'User not authenticated' });
                    return;
                }

                const res = await fetch(`${API_URL}/plans/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                const data = await res.json();

                if (res.ok) {
                    setPlans(data.plans);
                } else {
                    Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'No plans found' });
                }
            } catch (err) {
                console.error('❌ Error fetching plans:', err);
                Toast.show({ type: 'error', text1: 'Error', text2: 'Server error' });
            } finally {
                setLoading(false);
            }
        };

        fetchPlans();
    }, []);

    const renderPlanCard = (plan, index) => (
        <Card key={index} style={styles.card}>
            <Card.Content>
                <Title style={styles.planTitle}>Plan {plans.length - index}</Title>

                {/* Recommended Screenings */}
                <Title style={styles.sectionTitle}>🩺 Screenings</Title>
                {plan.structured_plan.recommended_screenings?.map((s, i) => (
                    <Paragraph key={i}>
                        • {s.condition}: {s.test} (Start at age {s.starting_age}, {s.frequency})
                    </Paragraph>
                ))}

                {/* Lifestyle */}
                <Title style={styles.sectionTitle}>💡 Lifestyle</Title>
                {plan.structured_plan.lifestyle_recommendations?.map((r, i) => (
                    <Paragraph key={i}>• {r}</Paragraph>
                ))}

                {/* Specialist Consultations */}
                <Title style={styles.sectionTitle}>👩‍⚕️ Specialists</Title>
                {plan.structured_plan.specialist_consultations?.map((s, i) => (
                    <Paragraph key={i}>• {s.speciality} ({s.urgency})</Paragraph>
                ))}

                <Text style={styles.footerText}>📅 Generated: {new Date(plan.createdAt).toLocaleDateString()}</Text>
            </Card.Content>
        </Card>
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Title style={styles.header}>My Health Plans</Title>
            {loading ? (
                <ActivityIndicator size="large" />
            ) : (
                <>
                    {plans.length === 0 ? (
                        <Paragraph>No plans available yet. Generate one from your test results!</Paragraph>
                    ) : (
                        <FlatList
                            data={plans}
                            renderItem={({ item, index }) => renderPlanCard(item, index)}
                            keyExtractor={(item, index) => `${item._id}-${index}`}
                        />
                    )}
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    card: {
        marginBottom: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        elevation: 3,
        padding: 10,
    },
    planTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF385C',
        marginBottom: 8,
    },
    sectionTitle: {
        marginTop: 10,
        fontWeight: '600',
        fontSize: 16,
        color: '#119658',
    },
    footerText: {
        marginTop: 12,
        fontSize: 12,
        color: '#999',
    },
});

export default MyPlansScreen;
