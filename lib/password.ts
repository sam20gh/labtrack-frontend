/**
 * Password strength, scored on the phone.
 *
 * Four levels because the kit draws four segments. The scoring is deliberately about
 * *composition* rather than a dictionary check: the app has no breach corpus on device,
 * and a meter that claimed more than it can measure would be the same mistake as a symptom
 * screen that shows a match percentage. It grades what it can see — length, case, digits,
 * symbols — and the copy says "add strength", never "this password is safe".
 */
export interface PasswordStrength {
    /** 0 when nothing has been typed; 1–4 otherwise. Also the number of segments to fill. */
    level: 0 | 1 | 2 | 3 | 4;
    label: string;
    emoji: string;
}

export const MIN_ACCEPTED_LEVEL = 2;

export function scorePassword(password: string): PasswordStrength {
    if (!password) return { level: 0, label: '', emoji: '' };

    let points = 0;
    if (password.length >= 6) points++;
    if (password.length >= 8) points++;
    if (/[A-Z]/.test(password)) points++;
    if (/[0-9]/.test(password)) points++;
    if (/[^A-Za-z0-9]/.test(password)) points++;

    if (points <= 1) return { level: 1, label: 'Weak! Add Strength!', emoji: '💪' };
    if (points <= 2) return { level: 2, label: 'Fair', emoji: '👍' };
    if (points <= 3) return { level: 3, label: 'Good', emoji: '✨' };
    return { level: 4, label: 'Amazing!', emoji: '🎉' };
}
