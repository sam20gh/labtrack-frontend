/**
 * The map — the only component that draws with the map SDK.
 *
 * It gets the SDK from `lib/run/map.ts`, never from an import, so a build without Mapbox
 * (or a bundle without a token) renders a plain panel instead of crashing. Recording never
 * depends on it: the map is a view.
 *
 * **Afterglow.** Mapbox Standard in its `monochrome` theme, so the base map recedes and the
 * trail is the only colour on it; the `lightPreset` follows the sun (`lib/run/sun.ts`). The
 * trail is up to three layers over one `lineMetrics` source:
 *
 *   glow    wide, blurred, translucent — the light the trail casts
 *   core    the pace gradient itself, Ember, slow dim → fast bright
 *   tail    live only: the last 400 m brightening towards the runner — the comet
 *
 * Three modes:
 *
 *   live      camera follows the puck at 45°
 *   overview  camera fitted to the route, flat, free to pan — the detail screen
 *   replay    camera flies the route at 60° while the trail draws itself up to `progress`
 *             (`lineTrimOffset` hides the part not yet run) behind a glowing dot
 *
 * Pedestrian paths are shown (they are where people run) and shop labels are not. Mapbox's
 * logo and attribution stay: its terms require them.
 */
import React, { useMemo } from 'react';
import { View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodyFont, Palettes, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { loadMapbox, mapUnavailableReason } from '@/lib/run/map';
import { boundsOf } from '@/lib/run/replay';
import type { Trail } from '@/lib/run/afterglow';
import type { LightPreset } from '@/lib/run/sun';

export interface ReplayCamera {
    center: number[];
    heading: number;
    /** 0–1 of the route drawn so far. */
    progress: number;
    /** How long the camera takes to reach this frame; the frame interval. */
    durationMs: number;
}

interface Props {
    trail: Trail;
    lightPreset: LightPreset;
    /** The fast end of the ramp — the puck, the glow and the replay dot wear it. */
    accent: string;
    mode?: 'live' | 'overview' | 'replay';
    replay?: ReplayCamera;
    /** Live only: off lets the person pan without being dragged back. */
    follow?: boolean;
    interactive?: boolean;
    style?: StyleProp<ViewStyle>;
}

const UNAVAILABLE_COPY = {
    not_in_build: 'The map needs the latest version of the app.',
    no_token: 'The map is not set up in this version of the app.',
} as const;

const STANDARD_STYLE = 'mapbox://styles/mapbox/standard';

const line = (coordinates: number[][]) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates },
});

export default function RunMap({
    trail, lightPreset, accent, mode = 'live', replay, follow = true, interactive = true, style,
}: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const Mapbox = loadMapbox();

    const route = useMemo(() => (trail.coordinates.length >= 2 ? line(trail.coordinates) : null), [trail.coordinates]);
    const tail = useMemo(() => (mode === 'live' && trail.tail ? line(trail.tail.coordinates) : null), [trail.tail, mode]);
    const bounds = useMemo(() => boundsOf(trail.coordinates), [trail.coordinates]);

    if (!Mapbox) {
        const reason = mapUnavailableReason() ?? 'not_in_build';
        return (
            <View style={[styles.fallback, style]} accessibilityRole="text">
                <Ionicons name="map-outline" size={28} color={Palette.textSecondary} />
                <Text style={styles.fallbackText}>
                    {UNAVAILABLE_COPY[reason]}{mode === 'live' ? ' Your route is still being recorded.' : ''}
                </Text>
            </View>
        );
    }

    const { MapView, Camera, LocationPuck, ShapeSource, LineLayer, CircleLayer, StyleImport } = Mapbox;
    const paint = trail.gradient ? { lineGradient: trail.gradient as never } : { lineColor: accent };
    const trim = mode === 'replay' && replay ? { lineTrimOffset: [Math.min(1, replay.progress), 1] } : {};

    return (
        <MapView
            style={[styles.map, style]}
            styleURL={STANDARD_STYLE}
            compassEnabled={false}
            scaleBarEnabled={false}
            logoEnabled
            attributionEnabled
            scrollEnabled={interactive && mode !== 'replay'}
            zoomEnabled={interactive && mode !== 'replay'}
            rotateEnabled={interactive && mode !== 'replay'}
            pitchEnabled={interactive && mode !== 'replay'}
            accessibilityLabel="Map of your route"
        >
            <StyleImport
                id="basemap"
                existing
                config={{
                    lightPreset,
                    theme: 'monochrome',
                    showPointOfInterestLabels: false,
                    showPedestrianRoads: true,
                    show3dObjects: true,
                }}
            />

            {mode === 'live' && (
                <>
                    <Camera followUserLocation={follow} followZoomLevel={16} followPitch={45} animationMode="easeTo" animationDuration={800} />
                    <LocationPuck puckBearingEnabled puckBearing="course" pulsing={{ isEnabled: true, color: accent }} />
                </>
            )}
            {mode === 'overview' && bounds && (
                <Camera
                    bounds={{ ne: bounds[1], sw: bounds[0] }}
                    padding={{ paddingTop: 40, paddingBottom: 40, paddingLeft: 32, paddingRight: 32 }}
                    animationDuration={0}
                />
            )}
            {mode === 'replay' && replay && (
                <Camera
                    centerCoordinate={replay.center}
                    heading={replay.heading}
                    pitch={60}
                    zoomLevel={16.2}
                    animationMode="linearTo"
                    animationDuration={replay.durationMs}
                />
            )}

            {route && (
                <ShapeSource id="afterglow" shape={route} lineMetrics>
                    <LineLayer
                        id="afterglow-glow"
                        style={{
                            ...paint, ...trim,
                            lineWidth: 16, lineBlur: 10, lineOpacity: 0.45,
                            lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1,
                        }}
                    />
                    <LineLayer
                        id="afterglow-core"
                        aboveLayerID="afterglow-glow"
                        style={{ ...paint, ...trim, lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1 }}
                    />
                </ShapeSource>
            )}
            {tail && trail.tail && (
                <ShapeSource id="afterglow-tail" shape={tail} lineMetrics>
                    <LineLayer
                        id="afterglow-comet"
                        aboveLayerID="afterglow-core"
                        style={{
                            lineGradient: trail.tail.gradient as never,
                            lineWidth: 3, lineCap: 'round', lineJoin: 'round', lineEmissiveStrength: 1,
                        }}
                    />
                </ShapeSource>
            )}
            {mode === 'replay' && replay && (
                <ShapeSource id="replay-dot" shape={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: replay.center } }}>
                    <CircleLayer id="replay-dot-glow" style={{ circleRadius: 16, circleColor: accent, circleOpacity: 0.3, circleBlur: 0.8, circleEmissiveStrength: 1 }} />
                    <CircleLayer id="replay-dot-core" aboveLayerID="replay-dot-glow" style={{ circleRadius: 6, circleColor: accent, circleStrokeWidth: 2, circleStrokeColor: Palettes.light.white, circleEmissiveStrength: 1 }} />
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
