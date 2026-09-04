import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    View,
    ActivityIndicator,
    StyleSheet,
    FlatList,
    Image,
    Dimensions,
    Text,
} from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useBasket } from '@/lib/basket';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** The card sits inside the scroll view's 15pt padding on both sides. */
const SLIDE_WIDTH = SCREEN_WIDTH - 30;

/**
 * Read a product's pictures.
 *
 * `images` is the gallery and `image` is its cover, kept in step by the API. A product
 * saved before the gallery existed has only the cover, so it falls back to a gallery of
 * one rather than showing nothing.
 */
const galleryOf = (product) => {
    if (Array.isArray(product?.images) && product.images.length) return product.images;
    return product?.image ? [product.image] : [];
};

/**
 * The pictures, as a swipeable strip.
 *
 * Paged rather than free-scrolling because each slide is a whole product photograph and a
 * half-scrolled pair reads as a rendering fault. The dots are drawn only when there is
 * more than one — a single dot under a single picture is a control that does nothing.
 *
 * Renders nothing at all when the catalogue entry has no picture, which is the honest
 * state: the old screen drew a `Card.Cover` at a fixed 250pt whether or not there was a
 * URL behind it, so a product with no image got a grey band that looked like a failed load.
 */
const Gallery = ({ images, name }) => {
    const [index, setIndex] = useState(0);

    if (!images.length) return null;

    if (images.length === 1) {
        return <Card.Cover source={{ uri: images[0] }} style={styles.cover} />;
    }

    return (
        <View>
            <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri) => uri}
                onMomentumScrollEnd={(event) => {
                    setIndex(Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH));
                }}
                renderItem={({ item, index: position }) => (
                    <Image
                        source={{ uri: item }}
                        style={styles.slide}
                        accessibilityLabel={`${name} — image ${position + 1} of ${images.length}`}
                    />
                )}
            />
            <View style={styles.dots}>
                {images.map((uri, position) => (
                    <View
                        key={uri}
                        style={[styles.dot, position === index && styles.dotActive]}
                    />
                ))}
            </View>
            <Text style={styles.counter}>
                {index + 1} of {images.length}
            </Text>
        </View>
    );
};

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
                <Gallery images={galleryOf(product)} name={product.name} />
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
    slide: {
        width: SLIDE_WIDTH,
        height: 250,
        resizeMode: 'cover',
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        paddingTop: 10,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D9D9D9',
    },
    dotActive: {
        backgroundColor: '#7C3AED',
    },
    counter: {
        textAlign: 'center',
        paddingTop: 4,
        fontSize: 12,
        color: '#8A8A8E',
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
