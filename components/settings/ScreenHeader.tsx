/**
 * The header every screen in the kit's "Profile Setting & Help Center" flow wears.
 *
 * A back chevron on its own row, then a large left-aligned title with a one-line subtitle
 * under it — `Design/profile.svg` draws this identically on all twenty-odd settings frames
 * (Security Settings, Units & Metrics, Help Center, Linked Devices, Subscription…). Five
 * screens copying the same three views is how a flow starts drifting on its chrome, which
 * is the reason `app/metrics/[kind].tsx` already gives for sharing a screen between kinds.
 *
 * The chevron carries a negative left inset so its own touch padding does not push the
 * glyph off the 20pt gutter the titles align to.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, Fonts, Spacing } from '@/constants/theme';

export const ScreenHeader = ({
    title, subtitle, action,
}: {
    title: string;
    subtitle?: string;
    /** Optional trailing control on the chevron's row — a "Save", a settings gear. */
    action?: React.ReactNode;
}) => {
    const router = useRouter();
    return (
        <View style={styles.wrap}>
            <View style={styles.navRow}>
                <Pressable
                    onPress={() => router.back()}
                    style={styles.back}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                {action}
            </View>
            <Text style={styles.title}>{title}</Text>
            {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
    navRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 36,
    },
    back: { marginLeft: -6, padding: 4 },
    title: {
        fontSize: 26, fontFamily: Fonts.bold, color: Palette.text,
        marginTop: Spacing.md, includeFontPadding: false,
    },
    subtitle: {
        fontSize: 14, fontFamily: Fonts.regular, color: Palette.textSecondary,
        marginTop: 6, lineHeight: 20,
    },
});

export default ScreenHeader;
