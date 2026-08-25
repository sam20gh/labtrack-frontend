/**
 * Onboarding slide artwork.
 *
 * The turing kit draws each onboarding slide the same way: a phone body peeking up from the
 * bottom of a lavender stage, with one or more white cards floating over its top edge
 * showing the feature being described. The cards are the point — they are miniatures of
 * real LabTrack surfaces, not decoration — so each one is rebuilt here rather than shipped
 * as a flat PNG. That keeps them on the app's own type and palette and lets them re-render
 * at any screen width.
 *
 * Charts use `react-native-svg` for the same reason `TrendChart` does: a handful of fixed
 * paths, no charting dependency.
 *
 * Two slides in the kit use stock photography (the video consult, the wellness library).
 * There are no such assets in the repo, so those render tinted placeholder blocks with an
 * icon. Drop real imagery in `assets/images/` and swap `PhotoBlock` for an `Image` when
 * the art is available.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Fonts, Palette } from '@/constants/theme';

/* ------------------------------------------------------------------ primitives */

/** White floating card. Every slide is built out of one or more of these. */
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Stand-in for the kit's stock photography. A tinted gradient with an icon reads as a
 * deliberate placeholder rather than a failed image load.
 */
function PhotoBlock({
    style,
    icon = 'image-outline',
    colors = ['#C4B5FD', '#8B5CF6'],
}: {
    style?: any;
    icon?: keyof typeof Ionicons.glyphMap;
    colors?: [string, string];
}) {
    return (
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.photo, style]}>
            <Ionicons name={icon} size={26} color="rgba(255,255,255,0.85)" />
        </LinearGradient>
    );
}

/* ------------------------------------------------------------------ slide 2 */

/** Health score card. The kit gives this one a purple→green→amber gradient hairline. */
function HealthScore() {
    return (
        <LinearGradient
            colors={['#7C3AED', '#10B981', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
        >
            <View style={styles.gradientBorderInner}>
                <View style={styles.row}>
                    <Ionicons name="sparkles" size={18} color={Palette.primary} />
                    <Text style={styles.scoreValue}>82.5pts</Text>
                    <View style={styles.flex} />
                    <View style={styles.chip}>
                        <Ionicons name="calendar-outline" size={12} color={Palette.text} />
                        <Text style={styles.chipText}>Weekly</Text>
                        <Ionicons name="chevron-down" size={12} color={Palette.text} />
                    </View>
                </View>
                <Text style={styles.scoreCaption}>Your health score is great. Keep it up!</Text>
                <View style={styles.hr} />

                <Svg width="100%" height={78} viewBox="0 0 300 78" preserveAspectRatio="none">
                    <Defs>
                        <SvgGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#10B981" stopOpacity="0.28" />
                            <Stop offset="1" stopColor="#10B981" stopOpacity="0" />
                        </SvgGradient>
                    </Defs>
                    <Path
                        d="M4 68 C24 62,32 28,54 28 C76 28,74 54,94 54 C110 54,116 8,138 8 C162 8,158 52,180 52 C198 52,202 18,224 18 C248 18,246 40,266 42 C280 43,290 40,296 38 L296 78 L4 78 Z"
                        fill="url(#scoreFill)"
                    />
                    <Path
                        d="M4 68 C24 62,32 28,54 28 C76 28,74 54,94 54 C110 54,116 8,138 8 C162 8,158 52,180 52 C198 52,202 18,224 18 C248 18,246 40,266 42 C280 43,290 40,296 38"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                    />
                </Svg>

                <View style={styles.rowBetween}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <Text key={d} style={styles.axisLabel}>{d}</Text>
                    ))}
                </View>

                <View style={styles.hr} />
                <View style={styles.rowCenter}>
                    <Ionicons name="trending-up" size={14} color={Palette.success} />
                    <Text style={styles.deltaText}>+12%</Text>
                    <Text style={styles.mutedSmall}> vs last week</Text>
                    <View style={styles.spacer} />
                    <Ionicons name="bulb-outline" size={14} color="#F59E0B" />
                    <Text style={styles.mutedSmall}> 8 insights</Text>
                </View>
            </View>
        </LinearGradient>
    );
}

/* ------------------------------------------------------------------ slide 3 */

const ACTIVITIES = [
    { name: 'Swimming', time: '12-25min', tag: 'Intense', tint: '#EF4444', icon: 'water-outline' },
    { name: 'Hiking', time: '12-25min', tag: 'Moderate', tint: '#F59E0B', icon: 'trail-sign-outline' },
    { name: 'Yoga', time: '15-40min', tag: 'Relaxed', tint: Palette.success, icon: 'leaf-outline' },
    { name: 'Martial Arts', time: '12-25min', tag: 'Intense', tint: '#EF4444', icon: 'flash-outline' },
] as const;

/** Scattered activity chips around a highlighted "Jogging" card. */
function DailyActivity() {
    return (
        <View style={styles.activityStage}>
            {ACTIVITIES.map((a, i) => (
                <View key={a.name} style={[styles.activityChip, ACTIVITY_POSITIONS[i]]}>
                    <Ionicons name={a.icon as any} size={16} color={Palette.text} />
                    <Text style={styles.activityName}>{a.name}</Text>
                    <Text style={styles.activityTime}>{a.time}</Text>
                    <View style={styles.rowCenter}>
                        <Ionicons name="heart" size={10} color={a.tint} />
                        <Text style={[styles.activityTag, { color: a.tint }]}> {a.tag}</Text>
                    </View>
                </View>
            ))}

            <Card style={styles.joggingCard}>
                <Ionicons name="walk-outline" size={26} color={Palette.text} />
                <Text style={styles.joggingName}>Jogging</Text>
                <Text style={styles.joggingTime}>12-25min</Text>
                <View style={styles.rowCenter}>
                    <Ionicons name="heart" size={12} color="#F59E0B" />
                    <Text style={[styles.activityTag, { color: '#F59E0B', fontSize: 12 }]}> Moderate</Text>
                </View>
            </Card>

            <View style={styles.recommendedPill}>
                <Ionicons name="star-outline" size={12} color={Palette.white} />
                <Text style={styles.recommendedText}>Recommended</Text>
            </View>
        </View>
    );
}

const ACTIVITY_POSITIONS = [
    { top: 42, left: 0, transform: [{ rotate: '-8deg' }] },
    { top: 4, left: 132, transform: [{ rotate: '7deg' }] },
    { bottom: 6, left: 6, transform: [{ rotate: '4deg' }] },
    { bottom: 34, right: 0, transform: [{ rotate: '-6deg' }] },
];

/* ------------------------------------------------------------------ slide 4 */

/** Three stacked metric cards: heart rate, sleep, hydration. */
function HealthMetrics() {
    return (
        <View style={styles.gap10}>
            <Card>
                <View style={styles.rowCenter}>
                    <Ionicons name="heart" size={14} color="#EF4444" />
                    <Text style={styles.metricTitle}> Heart Rate</Text>
                    <View style={styles.flex} />
                    <Text style={styles.mutedSmall}>Today</Text>
                    <Ionicons name="chevron-forward" size={12} color={Palette.textMuted} />
                </View>
                <View style={[styles.rowCenter, styles.mt8]}>
                    <View>
                        <Text style={styles.metricValue}>72<Text style={styles.metricUnit}> bpm</Text></Text>
                        <Text style={styles.mutedSmall}>Resting Rate</Text>
                    </View>
                    <View style={styles.flex} />
                    <Svg width={128} height={40} viewBox="0 0 128 40">
                        <Path
                            d="M2 10 L10 6 L18 16 L26 8 L34 20 L42 12 L50 22 L58 14 L66 26 L74 18 L82 28 L90 20 L98 30 L106 24 L114 32 L126 28"
                            stroke="#EF4444"
                            strokeWidth={1.8}
                            fill="none"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </View>
                <View style={styles.rowBetween}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <Text key={i} style={styles.axisLabel}>{d}</Text>
                    ))}
                </View>
            </Card>

            <Card>
                <View style={styles.rowCenter}>
                    <Ionicons name="moon" size={14} color={Palette.primary} />
                    <Text style={styles.metricTitle}> Sleep</Text>
                    <View style={styles.flex} />
                    <Text style={styles.mutedSmall}>Today</Text>
                    <Ionicons name="chevron-forward" size={12} color={Palette.textMuted} />
                </View>
                <View style={[styles.rowCenter, styles.mt8]}>
                    <View>
                        <Text style={styles.metricValue}>8.2<Text style={styles.metricUnit}> hr</Text></Text>
                        <Text style={styles.mutedSmall}>Well-rested</Text>
                    </View>
                    <View style={styles.flex} />
                    <View style={styles.rowCenter}>
                        {[true, false, false, true, false, false, true].map((done, i) => (
                            <View key={i} style={[styles.dayDot, done && styles.dayDotDone]}>
                                {done && <Ionicons name="checkmark" size={9} color={Palette.white} />}
                            </View>
                        ))}
                    </View>
                </View>
            </Card>

            <Card>
                <View style={styles.rowCenter}>
                    <Ionicons name="water" size={14} color="#3B82F6" />
                    <Text style={styles.metricTitle}> Hydration</Text>
                    <View style={styles.flex} />
                    <Text style={styles.mutedSmall}>Today</Text>
                    <Ionicons name="chevron-forward" size={12} color={Palette.textMuted} />
                </View>
                <View style={[styles.rowCenter, styles.mt8]}>
                    <View>
                        <Text style={styles.metricValue}>2,125<Text style={styles.metricUnit}> ml</Text></Text>
                        <Text style={styles.mutedSmall}>On Track</Text>
                    </View>
                    <View style={styles.flex} />
                    <View style={styles.barGroup}>
                        {[14, 20, 11, 24, 16, 26, 13].map((h, i) => (
                            <View key={i} style={[styles.hydrationBar, { height: h }]} />
                        ))}
                    </View>
                </View>
            </Card>
        </View>
    );
}

/* ------------------------------------------------------------------ slide 5 */

/** Chat with Dr T. Outgoing bubbles purple and right-aligned, replies white and left. */
function DrTChat() {
    return (
        <View style={styles.gap12}>
            <View style={styles.rowEnd}>
                <View style={styles.bubbleSent}>
                    <Text style={styles.bubbleSentText}>Hi doc T, how much water do I need to drink for today?</Text>
                    <View style={styles.bubbleMetaRight}>
                        <Text style={styles.bubbleTimeLight}>11:25</Text>
                        <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.8)" />
                    </View>
                </View>
                <View style={styles.avatar}>
                    <Ionicons name="person" size={14} color={Palette.white} />
                </View>
            </View>

            <View style={styles.rowStart}>
                <View style={styles.botAvatar}>
                    <Ionicons name="hardware-chip-outline" size={14} color={Palette.primary} />
                </View>
                <View style={styles.bubbleReceived}>
                    <Text style={styles.bubbleReceivedText}>
                        You&apos;re currently at 4 glasses—You need 4 more for today! Let&apos;s drink! 💧
                    </Text>
                    <View style={styles.bubbleMetaRight}>
                        <Text style={styles.bubbleTime}>11:25</Text>
                        <Ionicons name="checkmark-done" size={12} color={Palette.success} />
                    </View>
                </View>
            </View>

            <View style={styles.rowEnd}>
                <View style={[styles.bubbleSent, styles.bubbleShort]}>
                    <View style={styles.rowCenter}>
                        <Text style={styles.bubbleSentText}>Wow, amazing! XoXo 😊</Text>
                        <Text style={styles.bubbleTimeLight}>  11:25</Text>
                        <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.8)" />
                    </View>
                </View>
                <View style={styles.avatar}>
                    <Ionicons name="person" size={14} color={Palette.white} />
                </View>
            </View>
        </View>
    );
}

/* ------------------------------------------------------------------ slide 6 */

/** Video consult: full-bleed clinician, picture-in-picture self view, booking affordances. */
function VirtualCare() {
    return (
        <View style={styles.consultStage}>
            <PhotoBlock style={styles.consultMain} icon="person-outline" colors={['#DDD6FE', '#8B5CF6']} />
            <PhotoBlock style={styles.consultPip} icon="person-outline" colors={['#A5B4FC', '#6366F1']} />

            <View style={styles.bookPill}>
                <Ionicons name="calendar-outline" size={12} color={Palette.white} />
                <Text style={styles.bookPillText}>One Tap Book</Text>
            </View>

            <Card style={styles.doctorCard}>
                <Text style={styles.doctorName}>Dr. Melinda Yee</Text>
                <Text style={styles.mutedSmall}>General Practitioner</Text>
                <View style={[styles.rowCenter, styles.mt6]}>
                    {[0, 1, 2, 3].map((i) => (
                        <Ionicons key={i} name="star" size={12} color="#F59E0B" />
                    ))}
                    <Ionicons name="star-half" size={12} color="#F59E0B" />
                    <Text style={styles.mutedSmall}>  1,125</Text>
                </View>
            </Card>

            <View style={styles.callFab}>
                <Ionicons name="call" size={18} color={Palette.white} />
            </View>
        </View>
    );
}

/* ------------------------------------------------------------------ slide 7 */

const SLEEP_STAGES = [
    { pct: '11%', label: 'Awake', value: '32m', width: 0.24, color: '#F87171' },
    { pct: '18%', label: 'Post', value: '1h 3m', width: 0.38, color: '#C4B5FD' },
    { pct: '21%', label: 'Deep', value: '2h 33m', width: 0.55, color: Palette.primary },
    { pct: '32%', label: 'Core', value: '3h 20m', width: 0.82, color: '#1F2937' },
] as const;

/** Sleep breakdown: a headline duration then one filled bar per stage. */
function SleepMonitor() {
    return (
        <Card>
            <View style={styles.rowCenter}>
                <View style={styles.sleepBadge}>
                    <Text style={styles.sleepBadgeText}>Zz</Text>
                </View>
                <Text style={styles.metricValue}>  9.1<Text style={styles.metricUnit}> hour</Text></Text>
            </View>
            <Text style={[styles.mutedSmall, styles.mt6]}>Be sure to log your sleep metrics everyday!</Text>
            <View style={styles.hr} />

            {SLEEP_STAGES.map((s) => (
                <View key={s.label} style={styles.sleepRow}>
                    {/* Percentage width, not flex: the bar length *is* the datum, so it
                        has to stay proportional to the card rather than to whatever space
                        the labels beside it happen to leave over. */}
                    <View style={[styles.sleepBar, { backgroundColor: s.color, width: `${s.width * 100}%` }]}>
                        <Text style={[styles.sleepPct, s.color === '#C4B5FD' && { color: Palette.text }]}>{s.pct}</Text>
                    </View>
                    <Text style={styles.sleepLabel} numberOfLines={1}> {s.label} </Text>
                    <Text style={styles.mutedSmall} numberOfLines={1}>{s.value}</Text>
                </View>
            ))}
        </Card>
    );
}

/* ------------------------------------------------------------------ slide 8 */

/** Calorie ring plus macro split. The ring is one stroked circle with a dash offset. */
function Nutrition() {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const consumed = 0.54;

    return (
        <View style={styles.gap10}>
            <Card>
                <View style={styles.rowCenter}>
                    <PhotoBlock style={styles.mealThumb} icon="nutrition-outline" colors={['#FCA5A5', '#DC2626']} />
                    <Text style={styles.metricTitle}>  Strawberry Pie</Text>
                    <View style={styles.flex} />
                    <Text style={styles.mutedSmall}>10:23 AM</Text>
                    <Ionicons name="chevron-forward" size={12} color={Palette.textMuted} />
                </View>
                <View style={styles.hr} />

                <View style={styles.rowCenter}>
                    <View style={styles.calorieSide}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={Palette.success} />
                        <Text style={styles.calorieValue}>656</Text>
                        <Text style={styles.mutedSmall}>Consumed</Text>
                    </View>

                    <View style={styles.ringWrap}>
                        <Svg width={96} height={96} viewBox="0 0 96 96">
                            <Circle cx="48" cy="48" r={radius} stroke="#EEF0F4" strokeWidth={8} fill="none" />
                            <Circle
                                cx="48"
                                cy="48"
                                r={radius}
                                stroke={Palette.primary}
                                strokeWidth={8}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={`${circumference * consumed} ${circumference}`}
                                transform="rotate(-90 48 48)"
                            />
                        </Svg>
                        <View style={styles.ringCenter}>
                            <Text style={styles.ringValue}>584</Text>
                            <Text style={styles.mutedSmall}>Remaining</Text>
                        </View>
                    </View>

                    <View style={styles.calorieSide}>
                        <Ionicons name="flag-outline" size={18} color={Palette.textSecondary} />
                        <Text style={styles.calorieValue}>1220</Text>
                        <Text style={styles.mutedSmall}>Target</Text>
                    </View>
                </View>
            </Card>

            <View style={styles.macroRow}>
                {[
                    { label: 'Carb', color: '#F59E0B' },
                    { label: 'Fiber', color: '#1F2937' },
                    { label: 'Fat', color: '#EF4444' },
                ].map((m) => (
                    <Card key={m.label} style={styles.macroCard}>
                        <Text style={styles.macroLabel}>{m.label}</Text>
                        <View style={[styles.macroBar, { backgroundColor: m.color }]} />
                        <Text style={styles.mutedSmall}>35/77g</Text>
                    </Card>
                ))}
            </View>
        </View>
    );
}

/* ------------------------------------------------------------------ slide 9 */

/** Medication stack: two settled doses tilted behind the one awaiting an answer. */
function Medication() {
    return (
        <View style={styles.medStage}>
            <Card style={styles.medBack}>
                <View style={styles.rowCenter}>
                    <View style={styles.pillThumb}>
                        <Ionicons name="ellipse-outline" size={18} color={Palette.textSecondary} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.medName}>  Atorvaliq (atorvastatin)</Text>
                        <Text style={styles.mutedSmall}>  3 tablets  ·  Before Eating</Text>
                        <View style={[styles.rowCenter, styles.mt4]}>
                            <Ionicons name="close-circle" size={12} color={Palette.danger} />
                            <Text style={[styles.medStatus, { color: Palette.danger }]}> Skipped</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} />
                </View>
            </Card>

            <Card style={styles.medFront}>
                <View style={styles.rowCenter}>
                    <View style={styles.pillThumb}>
                        <Ionicons name="medkit-outline" size={18} color={Palette.primary} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.medName}>  Amoxiciline</Text>
                        <Text style={[styles.medTime]}>  1 tablet at 12:22 am  ›</Text>
                        <Text style={styles.mutedSmall}>  65mg  ·  After Meal</Text>
                    </View>
                </View>
                <View style={[styles.rowCenter, styles.mt10]}>
                    <View style={styles.medButtonGhost}>
                        <Text style={styles.medButtonGhostText}>Skipped</Text>
                    </View>
                    <View style={styles.medButtonPrimary}>
                        <Text style={styles.medButtonPrimaryText}>Taken</Text>
                    </View>
                </View>
            </Card>

            <Card style={styles.medBottom}>
                <View style={styles.rowCenter}>
                    <View style={styles.pillThumb}>
                        <Ionicons name="ellipse-outline" size={18} color={Palette.textSecondary} />
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.medName}>  Ibuprofen</Text>
                        <Text style={styles.mutedSmall}>  8 pills  ·  Before Eating</Text>
                        <View style={[styles.rowCenter, styles.mt4]}>
                            <Ionicons name="checkmark-circle" size={12} color={Palette.success} />
                            <Text style={[styles.medStatus, { color: Palette.success }]}> Taken</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} />
                </View>
            </Card>
        </View>
    );
}

/* ------------------------------------------------------------------ slide 10 */

/** Symptom chips converging on a single ranked match. */
function SymptomChecker() {
    return (
        <View style={styles.gap12}>
            <View style={styles.symptomRow}>
                {['light flu', 'headache', 'diarrhea'].map((s) => (
                    <View key={s} style={styles.symptomChip}>
                        <Text style={styles.symptomChipText}>{s}</Text>
                        <Ionicons name="close" size={11} color={Palette.white} />
                    </View>
                ))}
            </View>

            <Svg width="100%" height={46} viewBox="0 0 300 46" preserveAspectRatio="none">
                <Path
                    d="M40 0 L40 20 L150 20 M150 0 L150 46 M260 0 L260 20 L150 20"
                    stroke={Palette.text}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="none"
                />
                <Circle cx="150" cy="40" r="5" fill={Palette.text} />
                <Circle cx="150" cy="40" r="2" fill={Palette.white} />
            </Svg>

            <Card>
                <View style={styles.rowCenter}>
                    <View style={styles.matchBadge}>
                        <Ionicons name="bug-outline" size={16} color="#F59E0B" />
                    </View>
                    <Text style={styles.metricTitle}>  Influenza Type A</Text>
                    <View style={styles.flex} />
                    <Ionicons name="chevron-forward" size={14} color={Palette.textMuted} />
                </View>

                <View style={[styles.rowCenter, styles.mt10]}>
                    <Ionicons name="sparkles" size={12} color={Palette.primary} />
                    <Text style={styles.matchText}> 80% Match</Text>
                    <View style={styles.matchTrack}>
                        <View style={styles.matchFill} />
                    </View>
                    <View style={styles.riskDot} />
                    <Text style={styles.mutedSmall}> Mild Risk</Text>
                </View>

                <Text style={[styles.mutedSmall, styles.mt6]}>2 suggestion  ·  Treatable</Text>
            </Card>
        </View>
    );
}

/* ------------------------------------------------------------------ slide 11 */

/** Forward-looking blood-pressure projection, with the predicted figure called out in red. */
function Prediction() {
    return (
        <Card>
            <View style={styles.predictionChip}>
                <Ionicons name="scan-outline" size={12} color={Palette.text} />
                <Text style={styles.predictionChipText}>AI Prediction</Text>
            </View>

            <Text style={styles.predictionHeadline}>
                In 7 days, your blood pressure will elevate to{' '}
                <Text style={styles.predictionValue}>128/90±5mmHg</Text>
            </Text>

            <View style={[styles.rowCenter, styles.mt10]}>
                <View style={styles.yAxis}>
                    {['130', '120', '110', '100', '90', '80'].map((v) => (
                        <Text key={v} style={styles.axisLabel}>{v}</Text>
                    ))}
                </View>
                <View style={styles.flex}>
                    <Svg width="100%" height={116} viewBox="0 0 260 116" preserveAspectRatio="none">
                        <Defs>
                            <SvgGradient id="bpFill" x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor="#EF4444" stopOpacity="0.22" />
                                <Stop offset="1" stopColor="#EF4444" stopOpacity="0" />
                            </SvgGradient>
                        </Defs>
                        {[0, 23, 46, 69, 92, 115].map((y) => (
                            <Path key={y} d={`M0 ${y + 0.5} L260 ${y + 0.5}`} stroke="#EEF0F4" strokeWidth={1} />
                        ))}
                        <Path
                            d="M2 2 L14 66 L26 62 L38 34 L50 70 L62 68 L74 40 L86 100 L98 52 L110 30 L122 62 L134 2 L146 44 L158 74 L170 30 L182 66 L194 68 L206 46 L218 100 L230 60 L242 22 L256 68 L256 116 L2 116 Z"
                            fill="url(#bpFill)"
                        />
                        <Path
                            d="M2 2 L14 66 L26 62 L38 34 L50 70 L62 68 L74 40 L86 100 L98 52 L110 30 L122 62 L134 2 L146 44 L158 74 L170 30 L182 66 L194 68 L206 46 L218 100 L230 60 L242 22 L256 68"
                            stroke="#EF4444"
                            strokeWidth={2}
                            fill="none"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </View>
            </View>

            <View style={[styles.rowCenter, styles.mt10]}>
                <Ionicons name="warning-outline" size={14} color={Palette.danger} />
                <Text style={styles.mutedSmall}> 97% confidence level</Text>
                <View style={styles.flex} />
                <Text style={styles.takeAction}>Take Action</Text>
            </View>
        </Card>
    );
}

/* ------------------------------------------------------------------ slide 12 */

/** Overlapping library cards — an article, a video, and a second article behind. */
function Wellness() {
    return (
        <View style={styles.wellnessStage}>
            <Card style={styles.articleCard}>
                <PhotoBlock style={styles.articleImage} icon="leaf-outline" colors={['#86EFAC', '#059669']} />
                <View style={styles.articleBody}>
                    <Text style={styles.mutedSmall}>Jun 23, 2025  ·  Wellness</Text>
                    <Text style={styles.articleTitle}>Learn about cardio fitness &amp; how it&apos;s measured</Text>
                    <View style={[styles.rowCenter, styles.mt6]}>
                        <View style={styles.authorAvatar}>
                            <Ionicons name="person" size={9} color={Palette.white} />
                        </View>
                        <Text style={styles.mutedSmall}>  Julie Robertson</Text>
                        <View style={styles.flex} />
                        <Ionicons name="arrow-forward" size={13} color={Palette.textMuted} />
                    </View>
                </View>
            </Card>

            <Card style={styles.videoCard}>
                <View>
                    <PhotoBlock style={styles.videoImage} icon="mic-outline" colors={['#FBCFE8', '#DB2777']} />
                    <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                    </View>
                    <View style={styles.playButton}>
                        <Ionicons name="play" size={12} color={Palette.white} />
                    </View>
                    <Text style={styles.videoDuration}>01:40</Text>
                </View>
                <View style={styles.articleBody}>
                    <Text style={styles.articleTitle}>3 Easy Ways to Improve Your Slee...</Text>
                    <Text style={styles.mutedSmall}>Eddie Yong</Text>
                    <View style={[styles.rowCenter, styles.mt4]}>
                        <Ionicons name="eye-outline" size={11} color={Palette.textMuted} />
                        <Text style={styles.mutedSmall}> 5.5k</Text>
                    </View>
                </View>
            </Card>

            <Card style={styles.articleCardBack}>
                <View style={styles.articleBody}>
                    <Text style={styles.mutedSmall}>Jan 16, 2025  ·  Tag Name</Text>
                    <Text style={styles.articleTitle}>Sleep Smarter, Live Better: Improving Your Sleep</Text>
                    <View style={[styles.rowCenter, styles.mt6]}>
                        <Ionicons name="eye-outline" size={11} color={Palette.textMuted} />
                        <Text style={styles.mutedSmall}> 878  ·  </Text>
                        <Ionicons name="heart-outline" size={11} color={Palette.textMuted} />
                        <Text style={styles.mutedSmall}> 3</Text>
                    </View>
                </View>
                <PhotoBlock style={styles.articleImageRight} icon="restaurant-outline" colors={['#FDE68A', '#D97706']} />
            </Card>
        </View>
    );
}

/* ------------------------------------------------------------------ registry */

const VISUALS: Record<string, () => React.JSX.Element> = {
    '2': HealthScore,
    '3': DailyActivity,
    '4': HealthMetrics,
    '5': DrTChat,
    '6': VirtualCare,
    '7': SleepMonitor,
    '8': Nutrition,
    '9': Medication,
    '10': SymptomChecker,
    '11': Prediction,
    '12': Wellness,
};

/** Renders the artwork for a feature slide, or nothing if the id has no artwork. */
export default function SlideVisual({ id }: { id: string }) {
    const Visual = VISUALS[id];
    return Visual ? <Visual /> : null;
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
    // layout helpers
    flex: { flex: 1 },
    spacer: { width: 14 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowCenter: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    rowEnd: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end' },
    rowStart: { flexDirection: 'row', alignItems: 'flex-end' },
    gap10: { gap: 10 },
    gap12: { gap: 12 },
    mt4: { marginTop: 4 },
    mt6: { marginTop: 6 },
    mt8: { marginTop: 8 },
    mt10: { marginTop: 10 },

    card: {
        backgroundColor: Palette.white,
        borderRadius: 18,
        padding: 14,
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 6,
    },
    hr: {
        height: 1,
        backgroundColor: Palette.borderLight,
        marginVertical: 10,
    },
    photo: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        overflow: 'hidden',
    },
    mutedSmall: {
        fontSize: 11,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    axisLabel: {
        fontSize: 10,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },
    metricTitle: {
        fontSize: 13,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
    metricValue: {
        fontSize: 20,
        fontFamily: Fonts.bold,
        color: Palette.text,
    },
    metricUnit: {
        fontSize: 11,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
    },

    // slide 2
    gradientBorder: {
        borderRadius: 20,
        padding: 2,
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 6,
    },
    gradientBorderInner: {
        backgroundColor: Palette.white,
        borderRadius: 18,
        padding: 14,
    },
    scoreValue: {
        fontSize: 22,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginLeft: 6,
    },
    scoreCaption: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.text,
        marginTop: 6,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    chipText: {
        fontSize: 11,
        fontFamily: Fonts.medium,
        color: Palette.text,
    },
    deltaText: {
        fontSize: 11,
        fontFamily: Fonts.bold,
        color: Palette.success,
        marginLeft: 3,
    },

    // slide 3
    activityStage: {
        height: 300,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityChip: {
        position: 'absolute',
        backgroundColor: Palette.white,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        width: 118,
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 4,
    },
    activityName: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.text,
        marginTop: 4,
    },
    activityTime: {
        fontSize: 10,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        marginBottom: 3,
    },
    activityTag: {
        fontSize: 10,
        fontFamily: Fonts.semibold,
    },
    joggingCard: {
        width: 150,
        paddingVertical: 18,
    },
    joggingName: {
        fontSize: 18,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginTop: 8,
    },
    joggingTime: {
        fontSize: 13,
        fontFamily: Fonts.regular,
        color: Palette.textSecondary,
        marginBottom: 6,
    },
    recommendedPill: {
        position: 'absolute',
        top: 74,
        right: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Palette.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        transform: [{ rotate: '-8deg' }],
    },
    recommendedText: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        color: Palette.white,
    },

    // slide 4
    dayDot: {
        width: 15,
        height: 15,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    dayDotDone: {
        backgroundColor: Palette.primary,
        borderColor: Palette.primary,
    },
    barGroup: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 5,
        height: 28,
    },
    hydrationBar: {
        width: 5,
        borderRadius: 3,
        backgroundColor: '#3B82F6',
    },

    // slide 5
    bubbleSent: {
        backgroundColor: Palette.primary,
        borderRadius: 16,
        borderBottomRightRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: '80%',
    },
    bubbleShort: {
        paddingVertical: 8,
    },
    bubbleSentText: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.white,
        lineHeight: 18,
    },
    bubbleReceived: {
        backgroundColor: Palette.white,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        maxWidth: '80%',
        shadowColor: '#1F2937',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
    },
    bubbleReceivedText: {
        fontSize: 12,
        fontFamily: Fonts.regular,
        color: Palette.text,
        lineHeight: 18,
    },
    bubbleMetaRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
        marginTop: 4,
    },
    bubbleTime: {
        fontSize: 10,
        fontFamily: Fonts.regular,
        color: Palette.textMuted,
    },
    bubbleTimeLight: {
        fontSize: 10,
        fontFamily: Fonts.regular,
        color: 'rgba(255,255,255,0.8)',
    },
    avatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: Palette.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
    botAvatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },

    // slide 6
    consultStage: {
        height: 300,
        justifyContent: 'center',
    },
    consultMain: {
        height: 260,
        borderRadius: 20,
        marginHorizontal: 22,
    },
    consultPip: {
        position: 'absolute',
        top: 8,
        right: 0,
        width: 62,
        height: 84,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Palette.white,
    },
    bookPill: {
        position: 'absolute',
        right: 4,
        top: 132,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Palette.success,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    bookPillText: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        color: Palette.white,
    },
    doctorCard: {
        position: 'absolute',
        left: 0,
        bottom: 24,
        width: 168,
        padding: 12,
    },
    doctorName: {
        fontSize: 14,
        fontFamily: Fonts.bold,
        color: Palette.text,
    },
    callFab: {
        position: 'absolute',
        right: 6,
        bottom: 62,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // slide 7
    sleepBadge: {
        width: 28,
        height: 28,
        borderRadius: 9,
        backgroundColor: Palette.primarySurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sleepBadgeText: {
        fontSize: 12,
        fontFamily: Fonts.bold,
        color: Palette.primary,
    },
    sleepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    sleepBar: {
        height: 26,
        borderRadius: 7,
        justifyContent: 'center',
        paddingHorizontal: 8,
        // The longest bar plus its labels overruns the row; the bar keeps its length and
        // the labels take what is left, same as the kit draws it.
        flexShrink: 0,
    },
    sleepPct: {
        fontSize: 11,
        fontFamily: Fonts.bold,
        color: Palette.white,
    },
    sleepLabel: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },

    // slide 8
    mealThumb: {
        width: 26,
        height: 26,
        borderRadius: 13,
    },
    calorieSide: {
        alignItems: 'center',
        width: 62,
    },
    calorieValue: {
        fontSize: 17,
        fontFamily: Fonts.bold,
        color: Palette.text,
        marginTop: 4,
    },
    ringWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringCenter: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringValue: {
        fontSize: 22,
        fontFamily: Fonts.bold,
        color: Palette.text,
    },
    macroRow: {
        flexDirection: 'row',
        gap: 8,
    },
    macroCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    macroLabel: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
    macroBar: {
        height: 3,
        borderRadius: 2,
        alignSelf: 'stretch',
        marginVertical: 7,
    },

    // slide 9
    medStage: {
        height: 300,
        justifyContent: 'center',
    },
    medBack: {
        position: 'absolute',
        top: 8,
        left: 18,
        right: -6,
        transform: [{ rotate: '-3deg' }],
    },
    medFront: {
        marginHorizontal: 0,
    },
    medBottom: {
        position: 'absolute',
        bottom: 6,
        left: -6,
        right: 26,
        transform: [{ rotate: '3deg' }],
    },
    pillThumb: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: Palette.surface,
        borderWidth: 1,
        borderColor: Palette.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    medName: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
    medTime: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.primary,
        marginTop: 2,
    },
    medStatus: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
    },
    medButtonGhost: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Palette.border,
        marginRight: 8,
    },
    medButtonGhostText: {
        fontSize: 12,
        fontFamily: Fonts.medium,
        color: Palette.textSecondary,
    },
    medButtonPrimary: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: Palette.primarySurface,
    },
    medButtonPrimaryText: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.primary,
    },

    // slide 10
    symptomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    symptomChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Palette.primary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    symptomChipText: {
        fontSize: 11,
        fontFamily: Fonts.medium,
        color: Palette.white,
    },
    matchBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: Palette.warningSurface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    matchText: {
        fontSize: 11,
        fontFamily: Fonts.semibold,
        color: Palette.text,
    },
    matchTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: Palette.borderLight,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    matchFill: {
        width: '80%',
        height: '100%',
        borderRadius: 2,
        backgroundColor: '#F59E0B',
    },
    riskDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F59E0B',
    },

    // slide 11
    predictionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: Palette.border,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    predictionChipText: {
        fontSize: 11,
        fontFamily: Fonts.medium,
        color: Palette.text,
    },
    predictionHeadline: {
        fontSize: 15,
        fontFamily: Fonts.medium,
        color: Palette.text,
        lineHeight: 23,
        marginTop: 10,
    },
    predictionValue: {
        fontFamily: Fonts.bold,
        color: Palette.danger,
    },
    yAxis: {
        justifyContent: 'space-between',
        height: 116,
        marginRight: 6,
    },
    takeAction: {
        fontSize: 12,
        fontFamily: Fonts.bold,
        color: Palette.primary,
    },

    // slide 12
    wellnessStage: {
        height: 300,
        justifyContent: 'center',
    },
    articleCard: {
        position: 'absolute',
        top: 6,
        left: 0,
        right: 68,
        padding: 0,
        overflow: 'hidden',
        transform: [{ rotate: '-3deg' }],
    },
    articleCardBack: {
        position: 'absolute',
        bottom: 8,
        left: 22,
        right: -10,
        flexDirection: 'row',
        padding: 0,
        overflow: 'hidden',
        transform: [{ rotate: '2deg' }],
    },
    articleImage: {
        height: 96,
        borderRadius: 0,
    },
    articleImageRight: {
        width: 82,
        borderRadius: 0,
    },
    articleBody: {
        flex: 1,
        padding: 12,
    },
    articleTitle: {
        fontSize: 12,
        fontFamily: Fonts.semibold,
        color: Palette.text,
        lineHeight: 17,
        marginTop: 4,
    },
    authorAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Palette.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoCard: {
        position: 'absolute',
        top: 34,
        right: -6,
        width: 128,
        padding: 0,
        overflow: 'hidden',
    },
    videoImage: {
        height: 110,
        borderRadius: 0,
    },
    newBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: Palette.primary,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    newBadgeText: {
        fontSize: 10,
        fontFamily: Fonts.semibold,
        color: Palette.white,
    },
    playButton: {
        position: 'absolute',
        top: 42,
        alignSelf: 'center',
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoDuration: {
        position: 'absolute',
        left: 8,
        bottom: 8,
        fontSize: 10,
        fontFamily: Fonts.semibold,
        color: Palette.white,
    },
});
