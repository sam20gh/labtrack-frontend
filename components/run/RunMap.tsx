/**
 * The live session's map — the only component that draws with the map SDK.
 *
 * It gets the SDK from `lib/run/map.ts`, never from an import, so a build without Mapbox
 * (or a bundle without a token) renders a plain panel that says the recording is fine, and
 * does not crash. Recording never depends on the map: the map is a view of the recorder,
 * not part of it.
 *
 * R1 draws the route in the activity type's own tint. The pace-coloured Afterglow trail is
 * R2 (`lineGradient` over `lineMetrics`). **Not violet either way** — purple means "you can
 * act here" in this app, and a route is not a control.
 */
import React, { useMemo } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { loadMapbox, mapUnavailableReason } from '@/lib/run/map';
import { typeStyle } from '@/lib/activityTypes';

interface Props {
    /** `[lng, lat]` pairs, oldest first. */
    coordinates: number[][];
    type: string;
    /** Keep the camera on the person. Off lets them pan around without being dragged back. */
    follow?: boolean;
    style?: StyleProp<ViewStyle>;
}

const UNAVAILABLE_COPY = {
    not_in_build: 'The map needs the latest version of the app. Your route is still being recorded.',
    no_token: 'The map is not set up in this version of the app. Your route is still being recorded.',
} as const;

export default function RunMap({ coordinates, type, follow = true, style }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const Mapbox = loadMapbox();
    const tint = typeStyle(type).tint;

    const shape = useMemo(() => (coordinates.length >= 2
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates },
        }
        : null), [coordinates]);

    if (!Mapbox) {
        const reason = mapUnavailableReason() ?? 'not_in_build';
        return (
            <View style={[styles.fallback, style]} accessibilityRole="text">
                <Ionicons name="map-outline" size={28} color={Palette.textSecondary} />
                <Text style={styles.fallbackText}>{UNAVAILABLE_COPY[reason]}</Text>
            </View>
        );
    }

    const { MapView, Camera, LocationPuck, ShapeSource, LineLayer, StyleURL } = Mapbox;
    return (
        <MapView
            style={[styles.map, style]}
            styleURL={StyleURL.Dark}
            compassEnabled={false}
            scaleBarEnabled={false}
            // Mapbox's terms require the logo and attribution; they stay.
            logoEnabled
            attributionEnabled
            accessibilityLabel="Map of your route"
        >
            <Camera
                followUserLocation={follow}
                followZoomLevel={16}
                followPitch={30}
                animationMode="easeTo"
                animationDuration={800}
            />
            <LocationPuck puckBearingEnabled puckBearing="course" pulsing={{ isEnabled: true, color: tint }} />
            {shape && (
                <ShapeSource id="run-route" shape={shape}>
                    <LineLayer
                        id="run-route-line"
                        style={{ lineColor: tint, lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.95 }}
                    />
                </ShapeSource>
            )}
        </MapView>
    );
}

const useStyles = makeStyles((Palette) => ({
    map: { flex: 1 },
    fallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        padding: Spacing.xxl,
        backgroundColor: Palette.canvas,
        borderRadius: Radius.lg,
    },
    fallbackText: { ...BodyFont.regular, fontSize: 14, lineHeight: 20, color: Palette.textSecondary, textAlign: 'center' },
}));
