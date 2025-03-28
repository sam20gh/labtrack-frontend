import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Image, ScrollView } from 'react-native';
import { Title, Paragraph, ActivityIndicator, Card, Text, Button, IconButton, Menu, Provider as PaperProvider, List } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/config';
import Toast from 'react-native-toast-message';

const MyPlansScreen = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentYear = new Date().getFullYear();
    const [expandedYear, setExpandedYear] = useState('Urgently');
    const [visibleMenu, setVisibleMenu] = useState(null);

    useEffect(() => { fetchPlans(); }, []);

    const fetchPlans = async () => {
        const token = await AsyncStorage.getItem('authToken');
        const userId = await AsyncStorage.getItem('userId');
        try {
            const res = await fetch(`${API_URL}/plans/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (res.ok) setPlans(data.plans);
            else Toast.show({ type: 'error', text1: 'Error', text2: data.message || 'No plans found' });
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Server error' });
        } finally { setLoading(false); }
    };

    const deletePlan = async (planID) => {
        const token = await AsyncStorage.getItem('authToken');
        try {
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
            Toast.show({ type: 'error', text1: 'Error', text2: 'Server error' });
        }
    };

    const userDob = new Date('1986-05-20');
    const userAge = currentYear - userDob.getFullYear();

    const renderTimelineItem = (entry) => (
        <View key={entry.age} style={styles.timelineItem}>
            <Image source={{ uri: entry.image }} style={styles.entryImage} />
            <View style={styles.timelineContent}>
                <Text style={styles.timelineYear}>Age {entry.age}</Text>
                <Text style={styles.timelineLabel}>
                    {entry.type === 'test' ? `${entry.test}` : `${entry.speciality}`}
                    {entry.type === 'test' && entry.age <= userAge ? ' (Urgently)' : ''}
                </Text>
                {entry.productName && <Text style={styles.entryName}>{entry.productName}</Text>}
                {entry.professionalName && <Text style={styles.entryName}>{entry.professionalName}</Text>}
                <View style={styles.buttonContainer}>
                    {entry.productID && <Button mode="contained" style={styles.button}>Add to Basket</Button>}
                    {entry.professionalName && <Button mode="contained" style={styles.button}>Book</Button>}
                </View>
            </View>
        </View>
    );

    const renderPlanCard = (plan, index) => {
        const groupedByYear = plan.plan.reduce((acc, curr) => {
            const yearKey = curr.year <= currentYear ? 'Urgently' : curr.year;
            (acc[yearKey] = acc[yearKey] || []).push(curr);
            return acc;
        }, {});

        const sortedYears = Object.keys(groupedByYear).sort((a, b) => (a === 'Urgently' ? -1 : a - b));

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

                    <Paragraph>Recommended Screenings: {plan.structured_plan?.recommended_screenings.map(s => `${s.condition} (${s.test}, Age ${s.starting_age}, ${s.frequency})`).join('; ')}</Paragraph>
                    <Paragraph>Lifestyle Recommendations: {plan.structured_plan?.lifestyle_recommendations.join(', ')}</Paragraph>
                    <Paragraph>Specialist Consultations: {plan.structured_plan?.specialist_consultations.map(c => `${c.speciality} (Urgency: ${c.urgency})`).join('; ')}</Paragraph>

                    {sortedYears.map(year => (
                        <List.Accordion
                            key={year}
                            title={year === 'Urgently' ? 'Urgently' : `Year ${year}`}
                            expanded={expandedYear === year}
                            onPress={() => setExpandedYear(expandedYear === year ? null : year)}
                        >
                            {groupedByYear[year].map(renderTimelineItem)}
                        </List.Accordion>
                    ))}

                    <Text style={styles.footerText}>Generated: {new Date(plan.createdAt).toLocaleDateString()}</Text>
                </Card.Content>
            </Card>
        );
    };

    return (
        <PaperProvider>
            <ScrollView contentContainerStyle={styles.container}>
                <Title style={styles.header}>My Health Plans</Title>
                {loading ? <ActivityIndicator size="large" /> : (
                    plans.length === 0 ? <Paragraph>No plans available yet.</Paragraph> :
                        <FlatList data={plans} renderItem={({ item, index }) => renderPlanCard(item, index)} keyExtractor={(item) => item._id} />
                )}
            </ScrollView>
        </PaperProvider>
    );
};
const styles = StyleSheet.create({
    container: { padding: 12 },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
    card: { marginVertical: 6, borderRadius: 8, elevation: 2, backgroundColor: '#fff' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    planTitle: { fontSize: 16, fontWeight: 'bold', color: '#119658' },
    timelineItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    entryImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
    timelineContent: { flex: 1 },
    timelineYear: { fontWeight: 'bold', fontSize: 14 },
    timelineLabel: { fontSize: 14, marginTop: 2 },
    entryName: { fontSize: 13, color: '#555', marginTop: 2 },
    buttonContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
    button: { marginLeft: 8 },
    footerText: { marginTop: 8, fontSize: 12, color: '#888' },
});

export default MyPlansScreen;
