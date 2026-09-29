/**
 * Rate Our App — `Design/rating.svg`.
 *
 * The last card on the home screen, under News & Resources. One sentence and five stars;
 * tapping a star fills the row up to it and opens the store listing.
 *
 * **The link is a placeholder.** The app is not published yet, so `RATE_APP_URL` points
 * nowhere real. Replace it with the store listings once they exist — on iOS
 * `https://apps.apple.com/app/id<APP_ID>?action=write-review`, which opens straight onto the
 * review sheet, and on Android `https://play.google.com/store/apps/details?id=com.labtrack.app`.
 * Nothing else here has to change.
 *
 * Every star goes to the store, including one and two. Sending only the happy ones to a
 * review and the unhappy ones to a feedback form is review gating, which both stores'
 * policies forbid. The stars are a way in, not a rating this app records.
 *
 * Like `ExploreDoctorsCard`, it is a dark card in both schemes — the kit only draws it dark —
 * so every colour is pinned rather than read from the live palette. The kit's body copy is
 * Chakra Petch; here it is `BodyFont`, the rule for anything somebody reads.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';

import { Spacing, Radius, Fonts, BodyFont } from '@/constants/theme';
import { makeStyles } from '@/hooks/useTheme';

/** Placeholder until the app is in the stores — see the header. */
export const RATE_APP_URL = 'https://predyqt.com/rate';

/** The export's colours: Tailwind amber-950 ground, amber-500 edge and stars, gray-300 copy. */
const CARD = {
    ground: '#451A03',
    edge: '#F59E0B',
    star: '#F59E0B',
    title: '#FFFFFF',
    body: '#D1D5DB',
};

/** The export's star, first of five, in its own coordinates. */
const STAR_VIEWBOX = '57 116 37 36';
const STAR_SIZE = { width: 37, height: 36 };
/** The outer contour alone — the filled star. */
const STAR_SOLID =
    'M81.7174 127.109L93.1155 128.764L93.8089 130.896L85.5602 138.935L87.5084 150.287L85.6936 151.606L75.5 146.244L65.3063 151.606L63.4915 150.287L65.4381 138.935L57.191 130.896L57.8844 128.764L69.2809 127.109L74.3785 116.78H76.6214L81.7174 127.109Z';
/** Outer and inner contour, even-odd — the outlined star the kit draws. */
const STAR_OUTLINE =
    STAR_SOLID +
    'M71.2324 128.805L70.2916 129.488L60.749 130.873L67.6549 137.603L68.0146 138.71L66.3837 148.212L74.9189 143.726H76.081L84.6145 148.212L82.9853 138.71L83.345 137.603L90.2493 130.873L80.7083 129.488L79.7675 128.805L75.5 120.157L71.2324 128.805Z';

const STARS = [1, 2, 3, 4, 5];

export default function RateAppCard() {
    const styles = useStyles();
    const [chosen, setChosen] = useState(0);

    const rate = async (stars: number) => {
        setChosen(stars);
        try {
            await Linking.openURL(RATE_APP_URL);
        } catch {
            Toast.show({ type: 'error', text1: "Couldn't open the store", text2: 'Please try again later.' });
        }
    };

    return (
        <View style={styles.card}>
            <Text style={styles.title} accessibilityRole="header">Rate Our App</Text>
            <Text style={styles.body}>Help us improve our platform with your honest feedback.</Text>
            <View style={styles.stars}>
                {STARS.map((n) => (
                    <TouchableOpacity
                        key={n}
                        onPress={() => rate(n)}
                        style={styles.star}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                        accessibilityHint="Opens the app store to leave a review"
                    >
                        <Svg {...STAR_SIZE} viewBox={STAR_VIEWBOX}>
                            <Path
                                d={n <= chosen ? STAR_SOLID : STAR_OUTLINE}
                                fill={CARD.star}
                                fillRule="evenodd"
                            />
                        </Svg>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const useStyles = makeStyles(() => ({
    // Export: card 343×162 at x 16, title cap-top at 21 inside it, stars 109–144, 18 below.
    card: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.xxl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: CARD.edge,
        backgroundColor: CARD.ground,
        alignItems: 'center',
    },
    title: { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 24, color: CARD.title },
    body: {
        ...BodyFont.regular,
        fontSize: 14,
        lineHeight: 22,
        color: CARD.body,
        textAlign: 'center',
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.xl,
    },
    // Export: star centres 56 apart. Each touchable is that wide, so the hit target is too.
    stars: { flexDirection: 'row', marginTop: Spacing.md },
    star: { width: 56, height: 52, alignItems: 'center', justifyContent: 'center' },
}));
