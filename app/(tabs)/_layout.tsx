/**
 * The tab bar.
 *
 * Four tabs and a raised action button in the middle, drawn by `components/ui/AppTabBar.tsx`
 * — see that file for why the bar is written rather than configured.
 *
 * **Professionals is still a route, just not a tab.** `href: null` keeps `/(tabs)/professionals`
 * working for the four screens that push to it (the appointments diary, the booking
 * confirmation, and the Consult shortcut) while taking it out of the bar. Deleting the screen
 * would have broken those; moving the file would have changed its path.
 *
 * There is no global header here (`headerShown: false`), so **every tab screen owns its own
 * top inset** — wrap the root in `<SafeAreaView edges={['top']}>` and draw its own title.
 * The bar is absolutely positioned, so a screen that scrolls needs bottom padding of about
 * `TAB_BAR_HEIGHT` plus the safe-area inset or its last row sits under the bar.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { AppTabBar } from '@/components/ui/AppTabBar';

export default function TabLayout() {
    return (
        <Tabs
            tabBar={(props) => <AppTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            {/*
              The fourth slot is the assistant, not the profile. The profile is reachable from
              the avatar in the home header and is a screen people visit to change something
              and leave; the assistant is opened repeatedly within a session, which is what a
              tab is for. It lives at `app/profile.tsx`.
            */}
            <Tabs.Screen name="assistant" options={{ title: 'Assistant' }} />
            <Tabs.Screen name="orders" options={{ title: 'Order' }} />
            <Tabs.Screen name="results" options={{ title: 'Results' }} />

            {/* Routable, not drawn — see the note above. */}
            <Tabs.Screen name="professionals" options={{ href: null }} />
        </Tabs>
    );
}
