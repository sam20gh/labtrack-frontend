import React, { useEffect, useState } from 'react';
import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Card, Title, Paragraph } from 'react-native-paper';
import { API_URL } from '@/constants/config';
import { useRouter } from 'expo-router';
export default function ProductCardView() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetch(`${API_URL}/products`)
            .then((response) => response.json())
            .then((data) => {
                setProducts(data);
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching products:', error);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6200ee" />
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
    },
    title: {
        marginVertical: 5,
    },
    loadingIndicator: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    price: {
        marginTop: 5,
        fontWeight: 'bold',
    },
});
