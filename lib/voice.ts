/**
 * Audio capture for the assistant's Voice Mode.
 *
 * Thin on purpose — the screen owns the state machine, this owns the two decisions that
 * are easy to get quietly wrong.
 *
 * **The recording format.** `RecordingOptionsPresets.LOW_QUALITY` is the obvious choice for
 * speech and is a trap: on Android it produces `.3gp`/AMR-NB, which Whisper-compatible
 * endpoints do not accept, so it would work in the simulator and fail on every Android
 * phone. The preset below is m4a/AAC on both platforms — mono at 22.05kHz, which is above
 * what speech recognition uses internally and about a tenth the size of HIGH_QUALITY, so a
 * thirty-second question uploads in a moment on mobile data.
 *
 * **The iOS audio session.** Recording has to be enabled before `Audio.Recording` will
 * start and disabled afterwards, or the phone stays in record mode and everything the app
 * plays later comes out of the earpiece at a whisper. `endSession` is not optional cleanup.
 */
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

/** Mono AAC in an m4a container on both platforms. See the note above. */
export const SPEECH_RECORDING_OPTIONS: Audio.RecordingOptions = {
    isMeteringEnabled: true,
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 22050,
        numberOfChannels: 1,
        bitRate: 64000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.MEDIUM,
        sampleRate: 22050,
        numberOfChannels: 1,
        bitRate: 64000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 64000,
    },
};

/** What the finished file is, in the terms `FormData` and the server both use. */
export const recordingUpload = (uri: string) => ({
    uri,
    name: Platform.OS === 'web' ? 'question.webm' : 'question.m4a',
    mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a',
});

/** Put the session into record mode. Call before starting. */
export const beginSession = () =>
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

/** Take it back out. Call after stopping, including on unmount and on failure. */
export const endSession = () =>
    Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });

/**
 * Turn a metering reading into a bar height between 0 and 1.
 *
 * `metering` is dBFS: 0 is clipping and −160 is silence, and the interesting part of speech
 * lives in the top 50dB or so. Mapping the whole range linearly gives a waveform that
 * barely moves, which is the usual reason these look fake.
 */
export const meteringToLevel = (metering: number | undefined) => {
    if (metering === undefined || Number.isNaN(metering)) return 0;
    const FLOOR = -50;
    return Math.max(0, Math.min(1, (metering - FLOOR) / -FLOOR));
};

/** `mm:ss`, matching the timer under the design's stop button. */
export const formatDuration = (millis: number) => {
    const total = Math.floor(millis / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * How long one question may run.
 *
 * Voice Mode is for asking a thing, not for dictating a diary, and an unbounded recorder
 * left running in a pocket is a 25MB upload and a transcription bill. The screen stops
 * itself here and moves to the transcript rather than discarding what was said.
 */
export const MAX_RECORDING_MS = 2 * 60 * 1000;
