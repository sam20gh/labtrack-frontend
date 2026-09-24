/**
 * The route expo-router falls back to when nothing matches.
 *
 * It used to be the Expo template's own screen — "This screen doesn't exist." in the
 * template's `ThemedText`, on the template's `ThemedView`, in the template's palette, with
 * a link that said "Go to home screen!". Two fonts and a colour the rest of the app
 * abandoned, on the one screen a person reaches by following a link that has gone stale.
 *
 * It is reachable in ways that matter: a push notification for a dose whose medication was
 * since deleted, an achievement share link opened after the badge was revoked, a deep link
 * from an email into a feature the installed build does not have yet.
 *
 * Retry is deliberately absent — a route that does not exist will not exist on the second
 * attempt, which is the rule `lib/appState.ts` records as `retryable: false`.
 */
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StateView from '@/components/errors/StateView';

import { makeStyles } from '@/hooks/useTheme';
import { describeState } from '@/lib/appState';

export default function NotFoundScreen() {
    const styles = useStyles();
    const router = useRouter();

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
                <StateView
                    state={describeState('not_found', {
                        badge: 'Error Code: 404',
                        body: 'This link points somewhere that is no longer here. It may have been removed, or the link may be out of date.',
                    })}
                    primary={{
                        label: 'Back to Dashboard',
                        icon: 'home-outline',
                        onPress: () => router.replace('/(tabs)'),
                    }}
                    secondary={{
                        label: 'Contact Support',
                        icon: 'chatbubble-ellipses-outline',
                        onPress: () => router.push('/help'),
                    }}
                />
            </SafeAreaView>
        </>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.background },
}));
