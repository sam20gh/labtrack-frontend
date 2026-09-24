/**
 * Light status-bar glyphs for a screen whose deep hero sits under the status bar.
 *
 * The root layout sets the bar from the scheme — dark glyphs in light mode — which is right
 * for every screen that starts on the canvas and wrong for the two that start on
 * `heroGradient` (home and nutrition): dark glyphs on deep violet, a clock nobody can read.
 *
 * Rendered only while the screen is focused. React Native keeps status-bar settings as a
 * stack, pushed on mount and popped on unmount, and a tab or a stack screen stays mounted
 * underneath whatever is pushed over it — so an unconditional one here would keep forcing
 * light glyphs onto every screen opened from home.
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';

export function HeroStatusBar() {
    const focused = useIsFocused();
    return focused ? <StatusBar style="light" /> : null;
}

export default HeroStatusBar;
