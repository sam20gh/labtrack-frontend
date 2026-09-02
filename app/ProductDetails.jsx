import React, { useEffect, useState } from 'react';
import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useBasket } from '@/lib/basket';

export default function ProductDetails() {
    const route = useRoute();
    const router = useRouter();
    const { add, has } = useBasket();
    const { productId } = route.params;

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                setProduct(await api.get(`/products/${productId}`));
            } catch (error) {
                console.error('Error fetching product:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
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
                    {/* This used to log to the console. It is the same basket the shop and the
                        health plan fill, so checkout is one payment for everything in it. */}
                    {has(product._id) ? (
                        <Button mode="contained" style={styles.button} onPress={() => router.push('/basket')}>
                            In basket — view
                        </Button>
                    ) : (
                        <Button mode="contained" style={styles.button} onPress={() => add(product)}>
                            Add to basket
                        </Button>
                    )}
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
        color: '#7C3AED',
        marginBottom: 15,
    },
    button: {
        marginTop: 10,
        padding: 5,
        backgroundColor: '#7C3AED',
    },
});
