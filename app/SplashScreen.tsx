import React from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { API_URL } from '@/constants/config';
export default function SplashScreen() {
    const router = useRouter();

    return (
        <ImageBackground
            source={{ uri: `${API_URL}/assets/background-image.jpg` }}
            style={styles.background}
        >
            <View style={styles.overlay}>
                <Text style={styles.title}>Welcome to LabTrack</Text>
                <Text style={styles.subtitle}>Please log in or sign up to continue</Text>

                <Button mode="contained" style={styles.button} onPress={() => router.push('/loginscreen')}>
                    Log In
                </Button>
                <Button mode="outlined" style={styles.button} onPress={() => router.push('/signup')}>
                    Sign Up
                </Button>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        resizeMode: 'cover',
        justifyContent: 'center',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#ddd',
        marginBottom: 30,
        textAlign: 'center',
    },
    button: {
        width: '80%',
        marginVertical: 10,
    },
});
