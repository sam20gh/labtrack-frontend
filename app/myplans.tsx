import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Image, ScrollView } from 'react-native';
import {
    Title, Paragraph, ActivityIndicator, Card, Text,
    Button, IconButton, Menu, Provider as PaperProvider
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import Toast from 'react-native-toast-message';

const MyPlansScreen = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [visibleMenu, setVisibleMenu] = useState(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const userId = await AsyncStorage.getItem('userId');
            console.log("🔍 Fetching plans for userId:", userId);
            const res = await fetch(`${API_URL}/plans/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();

            if (res.ok) setPlans(data.plans);
            else Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'No plans found' });
        } catch (err) {
            console.error('❌ Error fetching plans:', err);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Server error' });
        } finally {
            setLoading(false);
        }
    };

    const deletePlan = async (planID) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            const res = await fetch(`${API_URL}/plans/delete/${planID}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                setPlans(plans.filter(plan => plan._id !== planID));
                Toast.show({ type: 'success', text1: 'Success', text2: data.message });
            } else {
                Toast.show({ type: 'error', text1: 'Error', text2: data.message });
            }
        } catch (err) {
            console.error('❌ Error deleting plan:', err);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Server error' });
        }
    };

    const renderPlanCard = (plan, index) => {
        const structured = plan?.structured_plan;

        const renderTimelineItem = (entry, i) => (
            <View key={`${entry.type}-${i}-${entry.age}`} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                    <Text style={styles.timelineYear}>Age {entry.age} • {entry.year}</Text>
                    {entry.type === 'test' ? (
                        <>
                            <Text style={styles.timelineLabel}>🧪 {entry.test}</Text>
                            {entry.productName && (
                                <View style={styles.productCard}>
                                    <Text style={styles.productName}>{entry.productName}</Text>
                                    {entry.productImage && (
                                        <Image
                                            source={{ uri: entry.productImage }}
                                            style={styles.productImage}
                                        />
                                    )}
                                    <Button
                                        key={`add-${entry.productID}-${i}`}
                                        mode="outlined"
                                        onPress={() => console.log("🛒 Add to Basket:", entry.productID)}
                                        style={styles.addButton}
                                    >
                                        Add to Basket
                                    </Button>
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={styles.timelineLabel}>👨‍⚕️ {entry.speciality}</Text>
                            <Text style={styles.professionalName}>Suggested: {entry.professionalName ?? 'Not assigned'}</Text>
                        </>
                    )}
                </View>
            </View>
        );

        return (
            <Card key={plan._id} style={styles.card}>
                <Card.Content>
                    <View style={styles.cardHeader}>
                        <Title style={styles.planTitle}>Plan {plans.length - index}</Title>
                        <Menu
                            visible={visibleMenu === plan._id}
                            onDismiss={() => setVisibleMenu(null)}
                            anchor={<IconButton icon="dots-vertical" onPress={() => setVisibleMenu(plan._id)} />}
                        >
                            <Menu.Item onPress={() => { setVisibleMenu(null); deletePlan(plan._id); }} title="Delete Plan" />
                        </Menu>
                    </View>

                    {structured && (
                        <>
                            <Title style={styles.sectionTitle}>🧠 AI Suggestions</Title>
                            <Paragraph>Screenings, lifestyle, and specialist recommendations provided by LabTrack AI.</Paragraph>
                        </>
                    )}

                    {plan.plan?.length > 0 && (
                        <>
                            <Title style={styles.sectionTitle}>📆 Timeline</Title>
                            {plan.plan.map(renderTimelineItem)}
                        </>
                    )}

                    <Text style={styles.footerText}>📅 Generated: {new Date(plan.createdAt).toLocaleDateString()}</Text>
                </Card.Content>
            </Card>
        );
    };

    return (
        <PaperProvider>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.container}>
                    <Title style={styles.header}>My Health Plans</Title>
                    {loading ? (
                        <ActivityIndicator size="large" />
                    ) : (
                        plans.length === 0 ? <Paragraph>No plans available yet. Generate one from your test results!</Paragraph> :
                            <FlatList
                                data={plans}
                                renderItem={({ item, index }) => renderPlanCard(item, index)}
                                keyExtractor={(item) => item._id}
                            />
                    )}
                </View>
            </ScrollView>
        </PaperProvider>
    );
};

const styles = StyleSheet.create({
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 10,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#119658',
        marginTop: 5,
        marginRight: 12,
    },
    timelineContent: {
        flex: 1,
    },
    timelineYear: {
        fontWeight: 'bold',
        marginBottom: 4,
    },
    timelineLabel: {
        fontSize: 16,
        marginBottom: 6,
    },
    productCard: {
        backgroundColor: '#f1f1f1',
        padding: 10,
        borderRadius: 8,
        marginTop: 6,
    },
    productName: {
        fontWeight: 'bold',
    },
    productImage: {
        width: 100,
        height: 100,
        marginVertical: 8,
        borderRadius: 8,
    },
    addButton: {
        alignSelf: 'flex-start',
        marginTop: 6,
    },
    professionalName: {
        marginTop: 4,
        fontStyle: 'italic',
    },
    container: { padding: 16 },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
    card: { marginBottom: 20, backgroundColor: '#fff', borderRadius: 10, elevation: 3, padding: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    planTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF385C', marginBottom: 8 },
    sectionTitle: { marginTop: 10, fontWeight: '600', fontSize: 16, color: '#119658' },
    footerText: { marginTop: 12, fontSize: 12, color: '#999' },
});

export default MyPlansScreen;
