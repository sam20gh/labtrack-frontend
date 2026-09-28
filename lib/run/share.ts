/**
 * Share a captured view as a picture — the poster.
 *
 * The same stance as `shareAchievementImage`: the file is the artefact, **nothing is
 * published**, no token is minted, and there is no public URL to leak or revoke. Where
 * `expo-sharing` is missing or the capture fails, it falls back to the system text share
 * with the numbers only — never a link, because there is no page for a run and there should
 * not be one: a route is location history.
 */
import type React from 'react';
import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export type RunShareOutcome = 'image' | 'text' | 'dismissed';

export const shareRunImage = async (
    view: React.RefObject<unknown>,
    fallbackText: string,
): Promise<RunShareOutcome> => {
    const available = await Sharing.isAvailableAsync().catch(() => false);
    if (available && view.current) {
        try {
            const uri = await captureRef(view as never, { format: 'png', quality: 1, result: 'tmpfile' });
            await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your activity' });
            return 'image';
        } catch {
            // Fall through to text rather than sending nothing.
        }
    }
    const result = await Share.share({ message: fallbackText });
    return result.action === Share.dismissedAction ? 'dismissed' : 'text';
};
