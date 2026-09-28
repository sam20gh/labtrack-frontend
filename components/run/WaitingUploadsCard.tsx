/**
 * "1 activity waiting to upload" — on the activity dashboard, only when there is one.
 *
 * A ride that is safe on the phone but not in the history is invisible without this: the
 * history is the server's, and the journal is not. The card says why it is waiting in plain
 * words — no connection, or the server did not accept it (with the code, for a bug report) —
 * and offers Try again. A successful retry opens the ride's summary.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { typeStyle } from '@/lib/activityTypes';
import { onUploadsChange, uploadRun, waitingRuns, type WaitingRun } from '@/lib/run/upload';
import { TYPE_LABEL } from '@/lib/run/format';

const why = (r: WaitingRun): string => {
    if (r.rejected) return `The server could not read it (${r.rejected}). It stays on this phone.`;
    if (!r.lastFailure) return 'Saved on this phone, waiting to upload.';
    if (r.lastFailure.kind === 'offline') return 'Waiting for a connection. It uploads by itself.';
    if (r.lastFailure.kind === 'auth') return 'Sign in again to upload it.';
    return `Predyqt's server did not accept it yet (error ${r.lastFailure.httpStatus}). It is safe here.`;
};

export default function WaitingUploadsCard({ style }: { style?: StyleProp<ViewStyle> }) {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const [runs, setRuns] = useState<WaitingRun[]>([]);

    const refresh = useCallback(() => setRuns(waitingRuns()), []);
    useFocusEffect(refresh);
    useEffect(() => onUploadsChange(refresh), [refresh]);

    if (!runs.length) return null;

    const retry = async (id: string) => {
        setRuns(waitingRuns().map((r) => (r.clientId === id ? { ...r, uploading: true } : r)));
        const result = await uploadRun(id);
        if (result.status === 'saved') router.push(`/activity/run/summary/${result.session._id}`);
        refresh();
    };

    return (
        <View style={style}>
        <View style={styles.card} accessibilityRole="summary">
            <View style={styles.head}>
                <Ionicons name="cloud-upload-outline" size={18} color={Palette.text} />
                <Text style={styles.title}>
                    {runs.length === 1 ? '1 activity waiting to upload' : `${runs.length} activities waiting to upload`}
                </Text>
            </View>
            {runs.map((r) => {
                const look = typeStyle(r.type);
                return (
                    <View key={r.clientId} style={styles.row}>
                        <View style={[styles.icon, { backgroundColor: look.surface }]}>
                            <MaterialCommunityIcons name={look.icon} size={18} color={look.tint} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.rowTitle}>
                                {TYPE_LABEL[r.type]} · {new Date(r.startedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                            </Text>
                            <Text style={styles.rowWhy}>{why(r)}</Text>
                        </View>
                        {!r.rejected && (
                            <Pressable
                                onPress={() => retry(r.clientId)}
                                disabled={r.uploading}
                                style={styles.retry}
                                accessibilityRole="button"
                                accessibilityLabel={`Try uploading the ${TYPE_LABEL[r.type].toLowerCase()} again`}
                            >
                                {r.uploading
                                    ? <ActivityIndicator size="small" color={Palette.primary} />
                                    : <Text style={styles.retryText}>Try again</Text>}
                            </Pressable>
                        )}
                    </View>
                );
            })}
        </View>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    card: { backgroundColor: Palette.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontSize: 14, fontFamily: Fonts.semibold, color: Palette.text },
    rowWhy: { ...BodyFont.regular, fontSize: 13, lineHeight: 18, color: Palette.textSecondary },
    retry: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.primary, minWidth: 88, alignItems: 'center' },
    retryText: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.primary },
}));
