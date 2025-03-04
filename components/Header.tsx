import React from 'react';
import { Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function Header() {
    const router = useRouter();

    return (
        <Appbar.Header>
            <Appbar.Content title="LabTrack" />
            <Appbar.Action icon="account-circle" onPress={() => router.push('/users')} />
        </Appbar.Header>
    );
}
