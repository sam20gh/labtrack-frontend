/**
 * Cycle tracker setup — five steps, one route.
 *
 * One route with steps rather than five files, for the reason `app/sleep/setup.tsx` gives:
 * answers carried between routes in params are answers that can be silently dropped by a
 * mistyped key, which `docs/KNOWN-ISSUES.md` records the health assessment doing today.
 *
 * **Nothing is saved until the last step.** Somebody who backs out halfway has told the app
 * nothing about their cycle, which is the right default for this data above all.
 *
 * Three decisions about what is asked:
 *
 * 1. **"I don't remember" and "Not sure" are answers, not failures.** Every question has one.
 *    The forecast says where its number came from, and a guess somebody was pressed into is
 *    worse than no number — it would be read back to them as a prediction.
 * 2. **Status is asked up front.** Hormonal contraception, pregnancy and breastfeeding each
 *    change what the tracker may say — no fertile window, no late reminders — and finding
 *    that out from a "3 days late" push is the wrong order.
 * 3. **The fertile window is off unless somebody turns it on**, and the switch carries the
 *    sentence that it is not contraception. It is not offered at all under a status that has
 *    no ovulation to estimate.
 *
 * The last period, when given, is logged as period days — the start and, if the usual length
 * is known, the days after it up to today — so the calendar shows it and the forecast reads it
 * as a real period rather than a setting.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, Spacing, Radius, BodyFont } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import { MonthGrid } from '@/components/ui/MonthGrid';
import {
    updateCyclePlan, editPeriodDays, today as localToday, addDays, daysBetween,
    STATUSES, FERTILE_DISCLAIMER, formatDayLong, type CycleStatus,
} from '@/lib/cycle';
import { ApiError } from '@/lib/api';

type Step = 'intro' | 'last' | 'lengths' | 'status' | 'options';
const ORDER: Step[] = ['intro', 'last', 'lengths', 'status', 'options'];

/** A number with − and +, and a "Not sure" that greys it out. */
function Stepper({
    label, hint, value, unsure, min, max, onChange, onUnsure,
}: {
    label: string; hint: string; value: number; unsure: boolean; min: number; max: number;
    onChange: (v: number) => void; onUnsure: (u: boolean) => void;
}) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.stepperCard}>
            <Text style={styles.stepperLabel}>{label}</Text>
            <Text style={styles.stepperHint}>{hint}</Text>
            <View style={[styles.stepperRow, unsure && { opacity: 0.35 }]}>
                <Pressable
                    style={styles.stepperBtn}
                    onPress={() => onChange(Math.max(min, value - 1))}
                    disabled={unsure || value <= min}
                    accessibilityRole="button"
                    accessibilityLabel={`Fewer days, currently ${value}`}
                >
                    <Ionicons name="remove" size={20} color={Palette.primary} />
                </Pressable>
                <Text style={styles.stepperValue} accessibilityLiveRegion="polite">
                    {value}<Text style={styles.stepperUnit}> days</Text>
                </Text>
                <Pressable
                    style={styles.stepperBtn}
                    onPress={() => onChange(Math.min(max, value + 1))}
                    disabled={unsure || value >= max}
                    accessibilityRole="button"
                    accessibilityLabel={`More days, currently ${value}`}
                >
                    <Ionicons name="add" size={20} color={Palette.primary} />
                </Pressable>
            </View>
            <Pressable
                style={styles.unsure}
                onPress={() => onUnsure(!unsure)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: unsure }}
            >
                <Ionicons name={unsure ? 'checkbox' : 'square-outline'} size={18} color={unsure ? Palette.primary : Palette.textMuted} />
                <Text style={styles.unsureText}>Not sure</Text>
            </Pressable>
        </View>
    );
}

function Toggle({ title, body, value, onChange }: { title: string; body?: string; value: boolean; onChange: (v: boolean) => void }) {
    const Palette = usePalette();
    const styles = useStyles();
    return (
        <View style={styles.toggle}>
            <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.toggleTitle}>{title}</Text>
                {body ? <Text style={styles.toggleBody}>{body}</Text> : null}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ true: Palette.primaryFill, false: Palette.borderStrong }}
                thumbColor={Palette.white}
                accessibilityLabel={title}
            />
        </View>
    );
}

export default function CycleSetupScreen() {
    const Palette = usePalette();
    const styles = useStyles();
    const router = useRouter();
    const todayDay = localToday();

    const [step, setStep] = useState<Step>('intro');
    const [month, setMonth] = useState(todayDay.slice(0, 7));
    const [lastStart, setLastStart] = useState<string | null>(null);
    const [periodLength, setPeriodLength] = useState(5);
    const [periodUnsure, setPeriodUnsure] = useState(false);
    const [cycleLength, setCycleLength] = useState(28);
    const [cycleUnsure, setCycleUnsure] = useState(false);
    const [status, setStatus] = useState<CycleStatus>('none');
    const [fertile, setFertile] = useState(false);
    const [remindSoon, setRemindSoon] = useState(true);
    const [remindLate, setRemindLate] = useState(true);
    const [discreet, setDiscreet] = useState(true);
    const [saving, setSaving] = useState(false);

    const index = ORDER.indexOf(step);
    const paused = status === 'pregnant' || status === 'breastfeeding';
    const fertileOffered = status === 'none' || status === 'perimenopause';

    const next = () => setStep(ORDER[Math.min(ORDER.length - 1, index + 1)]);
    const back = () => (index === 0 ? router.back() : setStep(ORDER[index - 1]));

    const finish = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await updateCyclePlan({
                enabled: true,
                onboarded: true,
                seed: {
                    lastPeriodStart: lastStart,
                    periodLength: periodUnsure ? null : periodLength,
                    cycleLength: cycleUnsure ? null : cycleLength,
                },
                status,
                showFertileWindow: fertileOffered && fertile,
                reminders: { periodSoon: remindSoon, late: remindLate },
                discreetPush: discreet,
            });
            if (lastStart) {
                const lastDay = periodUnsure ? lastStart : addDays(lastStart, periodLength - 1);
                await editPeriodDays({ add: daysBetween(lastStart, lastDay < todayDay ? lastDay : todayDay) });
            }
            router.replace('/cycle');
        } catch (err) {
            Alert.alert('Not saved', err instanceof ApiError ? err.message : 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const cta = step === 'intro' ? 'Get started' : step === 'options' ? 'Start tracking' : 'Continue';

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
                    <Ionicons name="chevron-back" size={24} color={Palette.text} />
                </Pressable>
                <View style={styles.progress} accessibilityLabel={`Step ${index + 1} of ${ORDER.length}`}>
                    {ORDER.map((s, i) => <View key={s} style={[styles.pip, i <= index && styles.pipOn]} />)}
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {step === 'intro' ? (
                    <View style={styles.intro}>
                        <View style={styles.hero}>
                            <View style={styles.heroInner}>
                                <Ionicons name="flower" size={56} color={Palette.cycle} />
                            </View>
                        </View>
                        <Text style={styles.title}>Know your cycle</Text>
                        <Text style={styles.body}>
                            Log your period in a tap and see when the next one is likely. Four quick
                            questions and you are set up — every one of them can be skipped.
                        </Text>
                        <View style={styles.bullets}>
                            {[
                                ['calendar-outline', 'Your periods, predictions and symptoms on one calendar'],
                                ['time-outline', 'When your next period is likely — a window of days, never a promise'],
                                ['lock-closed-outline', 'Private to you. Clinicians reviewing your results do not see it'],
                            ].map(([icon, line]) => (
                                <View key={line} style={styles.bullet}>
                                    <View style={styles.bulletIcon}>
                                        <Ionicons name={icon as never} size={16} color={Palette.cycle} />
                                    </View>
                                    <Text style={styles.bulletText}>{line}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}

                {step === 'last' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>When did your last period start?</Text>
                        <Text style={styles.bodyLeft}>
                            {lastStart ? `Started ${formatDayLong(lastStart)}.` : 'Tap the first day. A rough guess is fine.'}
                        </Text>
                        <MonthGrid
                            month={month}
                            onChangeMonth={setMonth}
                            maxMonth={todayDay.slice(0, 7)}
                            renderDay={(day) => {
                                const future = day > todayDay;
                                const on = day === lastStart;
                                return (
                                    <Pressable
                                        onPress={() => setLastStart(on ? null : day)}
                                        disabled={future}
                                        style={[styles.pick, on && styles.pickOn]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: on, disabled: future }}
                                        accessibilityLabel={formatDayLong(day)}
                                    >
                                        <Text style={[styles.pickText, future && styles.pickFuture, on && styles.pickTextOn]}>
                                            {Number(day.slice(-2))}
                                        </Text>
                                    </Pressable>
                                );
                            }}
                        />
                        <Pressable
                            style={styles.linkBtn}
                            onPress={() => { setLastStart(null); next(); }}
                            accessibilityRole="button"
                        >
                            <Text style={styles.link}>I don&apos;t remember</Text>
                        </Pressable>
                    </View>
                ) : null}

                {step === 'lengths' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>What is usual for you?</Text>
                        <Text style={styles.bodyLeft}>
                            Only used until you have logged two cycles — after that, predictions come
                            from your own periods.
                        </Text>
                        <Stepper
                            label="Period length"
                            hint="How many days you usually bleed"
                            value={periodLength} unsure={periodUnsure} min={2} max={10}
                            onChange={setPeriodLength} onUnsure={setPeriodUnsure}
                        />
                        <Stepper
                            label="Cycle length"
                            hint="From the first day of one period to the first day of the next"
                            value={cycleLength} unsure={cycleUnsure} min={21} max={45}
                            onChange={setCycleLength} onUnsure={setCycleUnsure}
                        />
                    </View>
                ) : null}

                {step === 'status' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>Does any of these apply?</Text>
                        <Text style={styles.bodyLeft}>It changes what the tracker predicts. You can change it any time.</Text>
                        <View style={{ gap: Spacing.sm }} accessibilityRole="radiogroup">
                            {STATUSES.map((s) => {
                                const on = status === s.key;
                                return (
                                    <Pressable
                                        key={s.key}
                                        style={[styles.option, on && styles.optionOn]}
                                        onPress={() => setStatus(s.key)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: on }}
                                    >
                                        <Ionicons
                                            name={on ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={on ? Palette.primary : Palette.textMuted}
                                        />
                                        <View style={{ flex: 1, gap: 2 }}>
                                            <Text style={styles.optionTitle}>{s.label}</Text>
                                            <Text style={styles.optionBody}>{s.body}</Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                {step === 'options' ? (
                    <View style={styles.stepBlock}>
                        <Text style={styles.question}>A few choices</Text>
                        <View style={styles.group}>
                            {fertileOffered ? (
                                <Toggle
                                    title="Show my fertile window"
                                    body={FERTILE_DISCLAIMER}
                                    value={fertile}
                                    onChange={setFertile}
                                />
                            ) : null}
                            {!paused ? (
                                <>
                                    <Toggle title="Remind me before my period" body="A couple of days before it is likely to start." value={remindSoon} onChange={setRemindSoon} />
                                    <Toggle title="Tell me if my period is late" body="Once, not every morning." value={remindLate} onChange={setRemindLate} />
                                </>
                            ) : null}
                            <Toggle
                                title="Keep reminders discreet"
                                body={'Your lock screen shows "A reminder from Predyqt" rather than what it is about.'}
                                value={discreet}
                                onChange={setDiscreet}
                            />
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <Pressable
                    style={styles.cta}
                    onPress={step === 'options' ? finish : next}
                    disabled={saving}
                    accessibilityRole="button"
                >
                    {saving
                        ? <ActivityIndicator color={Palette.white} size="small" />
                        : (
                            <>
                                <Text style={styles.ctaLabel}>{cta}</Text>
                                <Ionicons name="arrow-forward" size={18} color={Palette.white} />
                            </>
                        )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const useStyles = makeStyles((Palette) => ({
    screen: { flex: 1, backgroundColor: Palette.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: Spacing.lg,
    },
    progress: { flexDirection: 'row', gap: 6, flex: 1, justifyContent: 'center' },
    pip: { width: 20, height: 4, borderRadius: 2, backgroundColor: Palette.borderSlate },
    pipOn: { backgroundColor: Palette.primaryFill },

    content: { padding: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.xl },

    intro: { alignItems: 'center', gap: Spacing.lg },
    hero: {
        width: 150, height: 150, borderRadius: 75, backgroundColor: Palette.cycleSurface,
        alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg,
    },
    heroInner: {
        width: 104, height: 104, borderRadius: 52, backgroundColor: Palette.background,
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 26, fontFamily: Fonts.bold, color: Palette.text, textAlign: 'center' },
    body: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 },
    bodyLeft: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 21 },
    bullets: { gap: Spacing.md, alignSelf: 'stretch', marginTop: Spacing.sm },
    bullet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    bulletIcon: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.cycleSurface,
        alignItems: 'center', justifyContent: 'center',
    },
    bulletText: { flex: 1, fontSize: 14, ...BodyFont.regular, color: Palette.text, lineHeight: 20 },

    stepBlock: { gap: Spacing.lg },
    question: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.text, lineHeight: 32 },

    pick: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    pickOn: { backgroundColor: Palette.cycleFill },
    pickText: { fontSize: 13, ...BodyFont.medium, color: Palette.text },
    pickTextOn: { color: Palette.white, fontFamily: Fonts.semibold },
    pickFuture: { color: Palette.border },
    linkBtn: { alignSelf: 'center', paddingVertical: Spacing.sm },
    link: { fontSize: 14, ...BodyFont.medium, color: Palette.primary },

    stepperCard: {
        padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Palette.surface, gap: Spacing.sm,
    },
    stepperLabel: { fontSize: 16, fontFamily: Fonts.semibold, color: Palette.text },
    stepperHint: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary },
    stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
    stepperBtn: {
        width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Palette.border,
        alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.background,
    },
    stepperValue: { fontSize: 30, fontFamily: Fonts.bold, color: Palette.text },
    stepperUnit: { fontSize: 14, ...BodyFont.regular, color: Palette.textSecondary },
    unsure: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start', paddingVertical: 4 },
    unsureText: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary },

    option: {
        flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border,
    },
    optionOn: { borderColor: Palette.primary, backgroundColor: Palette.primaryTint },
    optionTitle: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.text },
    optionBody: { fontSize: 13, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 18 },

    group: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.borderLight, overflow: 'hidden' },
    toggle: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg,
        borderBottomWidth: 1, borderBottomColor: Palette.borderLight,
    },
    toggleTitle: { fontSize: 15, ...BodyFont.medium, color: Palette.text },
    toggleBody: { fontSize: 12, ...BodyFont.regular, color: Palette.textSecondary, lineHeight: 17 },

    footer: { padding: Spacing.xl, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Palette.borderLight },
    cta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.lg, borderRadius: Radius.pill, backgroundColor: Palette.primaryFill,
    },
    ctaLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Palette.white },
}));
