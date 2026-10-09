/**
 * Where the technician goes, in the shape a technician needs.
 *
 * A UK-style "line 1, line 2, postcode" form is the wrong shape for the UAE: there are no
 * postcodes, and a door is found by building, community, a landmark — and in Dubai by the
 * Makani number on the building plate, which pins the entrance exactly. So: building and
 * flat, area, emirate (only the ones we cover, as chips rather than free text, so a visit
 * can never be booked to a city nobody serves), then the optional helpers.
 *
 * No map pin yet. The backend takes coordinates, but the app's location permission is worded
 * for recording a run, and asking for it to find a front door would contradict the sentence
 * the person agreed to. It arrives with the next native build, alongside new wording.
 */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { BodyFont, Fonts, Radius, Spacing } from '@/constants/theme';
import { makeStyles, usePalette } from '@/hooks/useTheme';
import type { VisitDetails } from '@/lib/collection';

interface Props {
    value: VisitDetails;
    onChange: (next: VisitDetails) => void;
    serviceAreas: string[];
    /** The Makani field is Dubai's; offered only when the market is the UAE. */
    market: string;
}

export function VisitDetailsForm({ value, onChange, serviceAreas, market }: Props) {
    const Palette = usePalette();
    const styles = useStyles();
    const setAddress = (patch: Partial<VisitDetails['address']>) => onChange({ ...value, address: { ...value.address, ...patch } });

    return (
        <View>
            <View style={styles.field}>
                <Text style={styles.label}>{market === 'AE' ? 'Emirate' : 'City'}</Text>
                <View style={styles.chips}>
                    {serviceAreas.map((area) => {
                        const on = value.address.city === area;
                        return (
                            <TouchableOpacity
                                key={area}
                                onPress={() => setAddress({ city: area })}
                                style={[styles.chip, on && styles.chipOn]}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                            >
                                <Text style={[styles.chipText, on && styles.chipTextOn]}>{area}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Plain inputs, not a helper component defined in render: one of those remounts
                its input on every keystroke, which drops the keyboard. */}
            <View style={styles.field}>
                <Text style={styles.label}>Building and flat, or villa</Text>
                <TextInput style={styles.input} placeholderTextColor={Palette.textMuted} placeholder="e.g. Marina Heights, apartment 1204"
                    value={value.address.building} onChangeText={(t) => setAddress({ building: t })} />
            </View>
            <View style={styles.field}>
                <Text style={styles.label}>Area or community</Text>
                <TextInput style={styles.input} placeholderTextColor={Palette.textMuted} placeholder="e.g. Dubai Marina"
                    value={value.address.area} onChangeText={(t) => setAddress({ area: t })} />
            </View>
            <View style={styles.field}>
                <Text style={styles.label}>Street<Text style={styles.optional}>  optional</Text></Text>
                <TextInput style={styles.input} placeholderTextColor={Palette.textMuted}
                    value={value.address.street} onChangeText={(t) => setAddress({ street: t })} />
            </View>
            <View style={styles.field}>
                <Text style={styles.label}>Landmark<Text style={styles.optional}>  optional</Text></Text>
                <TextInput style={styles.input} placeholderTextColor={Palette.textMuted} placeholder="e.g. opposite the metro station"
                    value={value.address.landmark} onChangeText={(t) => setAddress({ landmark: t })} />
            </View>
            {market === 'AE' ? (
                <View style={styles.field}>
                    <Text style={styles.label}>Makani number<Text style={styles.optional}>  optional</Text></Text>
                    <TextInput style={styles.input} placeholderTextColor={Palette.textMuted} placeholder="10 digits on the building plate"
                        keyboardType="number-pad" maxLength={11}
                        value={value.address.makani} onChangeText={(t) => setAddress({ makani: t.replace(/[^\d ]/g, '') })} />
                </View>
            ) : null}
            <View style={styles.field}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput style={styles.input} placeholderTextColor={Palette.textMuted} placeholder="+971 50 123 4567"
                    keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
                    value={value.phone} onChangeText={(t) => onChange({ ...value, phone: t })} />
                <Text style={styles.hint}>The technician calls this number if they cannot find you.</Text>
            </View>
            <View style={styles.field}>
                <Text style={styles.label}>Name at the door<Text style={styles.optional}>  optional</Text></Text>
                <TextInput style={styles.input} placeholderTextColor={Palette.textMuted}
                    value={value.contactName} onChangeText={(t) => onChange({ ...value, contactName: t })} />
            </View>
            <View style={styles.field}>
                <Text style={styles.label}>Notes for the technician<Text style={styles.optional}>  optional</Text></Text>
                <TextInput style={[styles.input, styles.multiline]} placeholderTextColor={Palette.textMuted} multiline
                    placeholder="Gate code, parking, which entrance…"
                    value={value.accessNotes} onChangeText={(t) => onChange({ ...value, accessNotes: t })} />
            </View>
        </View>
    );
}

const useStyles = makeStyles((Palette) => ({
    field: { marginBottom: Spacing.md },
    label: { fontSize: 13, fontFamily: Fonts.semibold, color: Palette.text, marginBottom: 6 },
    optional: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted },
    input: {
        borderWidth: 1, borderColor: Palette.borderStrong, borderRadius: Radius.lg, backgroundColor: Palette.background,
        paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: 15, ...BodyFont.regular, color: Palette.text,
    },
    multiline: { minHeight: 72, textAlignVertical: 'top' },
    hint: { fontSize: 12, ...BodyFont.regular, color: Palette.textMuted, marginTop: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { borderWidth: 1, borderColor: Palette.border, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7, backgroundColor: Palette.background },
    chipOn: { backgroundColor: Palette.primaryFill, borderColor: Palette.primaryFill },
    chipText: { fontSize: 13, ...BodyFont.medium, color: Palette.text },
    chipTextOn: { color: Palette.white },
}));

export default VisitDetailsForm;
