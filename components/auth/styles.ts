/**
 * Layout constants shared by the sign-in and sign-up screens, so the two cannot drift.
 *
 * The numbers are measured off `Design/auth.png`: a 16pt gutter (343pt of content on a
 * 375pt frame), 48pt controls, and `Radius.sm` corners — the same geometry the rest of the
 * turing kit uses, not something invented for auth.
 */
import { StyleSheet } from 'react-native';
import { Fonts, Palette, Radius } from '@/constants/theme';

export const GUTTER = 16;
export const CONTROL_HEIGHT = 48;

export const authStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Palette.background,
    },
    flex: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: GUTTER,
        paddingTop: 24,
        paddingBottom: 40,
    },

    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: CONTROL_HEIGHT,
        borderRadius: Radius.sm,
        backgroundColor: Palette.primary,
    },
    primaryButtonDisabled: {
        backgroundColor: '#EDE9FE',
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: Fonts.semibold,
        color: Palette.white,
    },
    primaryButtonTextDisabled: {
        color: Palette.primaryLight,
    },

    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginVertical: 22,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Palette.borderSlate,
    },
    dividerText: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.textSecondary,
        letterSpacing: 1,
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 'auto',
        paddingTop: 48,
    },
    footerText: {
        fontSize: 14,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    footerLink: {
        fontSize: 14,
        fontFamily: Fonts.bold,
        color: Palette.primary,
        textDecorationLine: 'underline',
    },
});
