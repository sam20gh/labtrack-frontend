/**
 * Profile photographs.
 *
 * `User.profileImage` holds a **Cloudflare delivery URL, never the bytes**. The upload goes
 * to `POST /api/images/upload`, which streams the file to Cloudflare Images and answers
 * with `https://imagedelivery.net/{account}/{id}/public`; that string is what
 * `PUT /users/:id` then stores. A base64 avatar on the user document would be re-sent on
 * every authenticated request that loads a user, which is the mistake `Plan.plan[]` made.
 *
 * Three things worth knowing before changing any of it:
 *
 * 1. **The picker crops to a square before the upload, not after.** An avatar is drawn in a
 *    circle everywhere it appears, so a 4:3 photograph would be centre-cropped by the
 *    `<Image>` at render — differently on each screen, and with no way for the person to
 *    say which part of it mattered. `allowsEditing` with a 1:1 aspect makes that choice
 *    theirs, once, before anything is stored.
 * 2. **`quality: 0.7` and a 512pt cap are deliberate.** The largest an avatar is drawn is
 *    92pt (the profile hub), so a 12-megapixel original is roughly 500× more image than any
 *    screen can use, paid for on every upload and every load.
 * 3. **Uploading does not save.** `pickAvatar` returns a URL and nothing else; the caller
 *    decides whether it reaches the record. Same checkpoint report ingestion puts between a
 *    misread digit and the record, and the reason the settings form only persists on Save.
 *
 * The old URL is not deleted from Cloudflare when a new one replaces it. Cleaning up
 * orphaned images needs a job that knows which URLs are still referenced, and deleting on
 * replace would destroy the image a half-finished edit was about to keep.
 */
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '@/constants/config';
import { getAccessToken } from './auth';

/** Longest edge, in pixels, of the file that leaves the device. */
const MAX_EDGE = 512;

export class AvatarError extends Error { }

/**
 * Send one local file to Cloudflare and return its delivery URL.
 *
 * Written against `fetch` rather than `api.post` for the same reason `lib/reports.ts` is:
 * React Native's `FormData` file part needs `{ uri, name, type }` and the boundary has to
 * be set by fetch itself, which means not going through the JSON body path.
 */
export const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset): Promise<string> => {
    const token = await getAccessToken();
    if (!token) throw new AvatarError('You need to be signed in to change your photo.');

    const form = new FormData();
    // React Native's FormData takes this shape for file parts.
    form.append('image', {
        uri: asset.uri,
        name: asset.fileName ?? `avatar.${asset.uri.split('.').pop() || 'jpg'}`,
        type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    const response = await fetch(`${API_URL}/images/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.imageUrl) {
        throw new AvatarError(data.message || 'Could not upload that photo.');
    }
    return data.imageUrl as string;
};

/**
 * Ask for a photograph, crop it square, upload it, hand back the URL.
 *
 * Returns `null` when the person cancelled — a cancel is not a failure and must not raise.
 * Anything else throws `AvatarError` with a sentence the caller can show as-is.
 */
export const pickAvatar = async (
    source: 'library' | 'camera',
): Promise<string | null> => {
    if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            throw new AvatarError('Allow camera access to take a profile photo.');
        }
    }

    const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
    };

    const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset) return null;

    // A picker that returns something enormous despite `allowsEditing` — a panorama the
    // person declined to crop, on an Android OEM that ignores the flag — is worth
    // refusing here rather than pushing megabytes at Cloudflare.
    if (asset.width && asset.height && Math.max(asset.width, asset.height) > MAX_EDGE * 8) {
        throw new AvatarError('That image is too large. Try a smaller photo.');
    }

    return uploadAvatar(asset);
};
