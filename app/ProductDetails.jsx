import React, { useEffect, useState } from 'react';
import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRoute } from '@react-navigation/native';

export default function ProductDetails() {
    const route = useRoute();
    const { productId } = route.params;

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}/products/${productId}`)
            .then((res) => res.json())
            .then((data) => {
                setProduct(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching product:', error);
                setLoading(false);
            });
    }, [productId]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6200ee" />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Card style={styles.card}>
                <Card.Cover source={{ uri: product.image }} style={styles.cover} />
                <Card.Content>
                    <Title style={styles.title}>{product.name}</Title>
                    <Paragraph style={styles.description}>{product.description}</Paragraph>
                    <Paragraph style={styles.price}>£{product.price}</Paragraph>
                    <Button mode="contained" style={styles.button} onPress={() => console.log('Add to Cart pressed')}>
                        Add to Cart
                    </Button>
                </Card.Content>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 15,
        backgroundColor: '#f7f7f7',
        flexGrow: 1,
    },
    card: {
        elevation: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    cover: {
        height: 250,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        marginTop: 10,
        fontSize: 22,
    },
    description: {
        marginVertical: 10,
        fontSize: 16,
        color: '#555',
    },
    price: {
        fontWeight: 'bold',
        fontSize: 18,
        color: '#FF385C',
        marginBottom: 15,
    },
    button: {
        marginTop: 10,
        padding: 5,
        backgroundColor: '#FF385C',
    },
});
