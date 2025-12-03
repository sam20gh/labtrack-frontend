import React, { useEffect, useState } from 'react';
import { ScrollView, View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Product {
    _id: string;
    name: string;
    description: string;
    price: number;
    image: string;
}

export default function ProductCardView() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const token = await AsyncStorage.getItem('authToken');
                const response = await fetch(`${API_URL}/products`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'Failed to fetch products');
                    setLoading(false);
                    return;
                }

                if (Array.isArray(data)) {
                    setProducts(data);
                } else {
                    setError('Invalid response from server');
                }
            } catch (err) {
                console.error('Error fetching products:', err);
                setError('Failed to load products');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6200ee" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {products.map((product) => (
                <Card key={product._id} style={styles.card} onPress={() => router.push({ pathname: '/ProductDetails', params: { productId: product._id } })}>
                    <Card.Cover source={{ uri: product.image }} style={styles.cover} />
                    <Card.Content>
                        <Title style={styles.title}>{product.name}</Title>
                        <Paragraph style={styles.description}>{product.description}</Paragraph>
                        <Paragraph style={styles.price}>£{product.price}</Paragraph>
                    </Card.Content>
                </Card>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 10,
        backgroundColor: '#f7f7f7',
    },
    card: {
        marginBottom: 15,
        elevation: 3,
    },
    cover: {
        height: 200,
    },
    title: {
        fontWeight: 'bold',
        marginVertical: 5,
    },
    description: {
        marginVertical: 5,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    price: {
        marginTop: 5,
        fontWeight: 'bold',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
    },
});
