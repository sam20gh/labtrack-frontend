/**
 * The first-run journey: tell us about yourself, get a package, bring in earlier results,
 * connect a device — then wait about two weeks while the kits go to a laboratory and back.
 *
 * Every number here is the server's (`GET /api/onboarding`, `utils/onboardingState.js`), and
 * none of it is stored as "step done": a step completes when its row exists, wherever it was
 * done from. The client only *decides where to go* — `landAfterSignIn` — and draws.
 *
 * Three surfaces read it:
 *   - `app/welcome`              the hub a new account lands on after its first sign-in
 *   - `components/home/JourneyCard`  the card at the top of home until it is all done
 *   - `app/journey/update`       "what changed" when the DNA (or any kit) comes back
 */
import type { Href, Router } from 'expo-router';
import { api, apiFetch } from './api';
import type { ComponentKind, Product } from '@/types/api';

export type StepKey = 'profile' | 'package' | 'results' | 'device';
export type StepStatus = 'done' | 'todo' | 'in_progress' | 'skipped' | 'waiting';

export interface JourneyStep {
    key: StepKey;
    status: StepStatus;
    title: string;
    detail: string;
    action: { label: string; route: string } | null;
    orderId?: string;
}

export interface JourneyKit {
    orderId: string;
    itemId: string;
    componentId: string | null;
    kind: ComponentKind;
    label: string;
    product: string;
    status: string;
    statusLabel: string;
    progress: number;
    done: boolean;
    wait: string | null;
    stages: { key: string; label: string; reached: boolean }[];
    updatedAt: string | null;
}

export interface Journey {
    stage: 'setting_up' | 'waiting' | 'ready' | 'complete';
    showWelcome: boolean;
    showJourney: boolean;
    welcomedAt: string | null;
    steps: JourneyStep[];
    next: ({ key: StepKey; label: string; route: string }) | null;
    progress: { done: number; total: number };
    profileMore: { title: string; detail: string; route: string } | null;
    kits: JourneyKit[];
    analysis: {
        exists: boolean;
        generatedAt: string | null;
        includesDna: boolean;
        includesBlood: boolean;
        waitingFor: ComponentKind[];
    };
    learned: { results: number; nights: number; activities: number; days: number };
}

export interface AnalysisUpdate {
    withheld: boolean;
    message?: string;
    generatedAt: string;
    previousAt?: string | null;
    reads: { dna: number; results: number };
    headline?: string | null;
    whatItMeans?: string | null;
    nextStep?: string | null;
    first?: boolean;
    added?: number;
    removed?: number;
    changes?: Record<'screenings' | 'consultations' | 'lifestyle', {
        added: { title: string; detail: string | null }[];
        removed: { title: string; detail: string | null }[];
        kept: number;
    }>;
}

export interface Storefront {
    packages: (Product & { _id: string; currency: string })[];
    addons: (Product & { _id: string; currency: string })[];
    payment: { available: boolean; testMode: boolean };
}

export const getJourney = () => api.get<Journey>('/onboarding');
export const markWelcomed = () => apiFetch<Journey>('/onboarding/welcomed', { method: 'POST' });
export const skipStep = (step: StepKey) => apiFetch<Journey>('/onboarding/skip', { method: 'POST', body: { step } });
export const resumeStep = (step: StepKey) => apiFetch<Journey>('/onboarding/resume', { method: 'POST', body: { step } });
export const dismissJourney = (undo = false) =>
    apiFetch<Journey>('/onboarding/dismiss', { method: 'POST', body: undo ? { undo: true } : {} });
export const claimKit = (code: string) =>
    apiFetch<{ message: string; already: boolean; order: { _id: string; items: { name: string }[] }; journey: Journey }>(
        '/onboarding/claim', { method: 'POST', body: { code } });
export const getAnalysisUpdate = () => api.get<AnalysisUpdate>('/onboarding/analysis-update');
export const getStorefront = () => api.get<Storefront>('/checkout/packages');

/**
 * Where a sign-in lands: the welcome hub for somebody who has not told us about themselves
 * yet, home for everybody else.
 *
 * Asked of the server rather than inferred from "this was a sign-up", because the email
 * confirmation link means the first session usually begins on the *login* screen, minutes
 * after the sign-up screen was closed. **Fails open to home**: a journey that cannot be read
 * must never stand between somebody and their account.
 */
export const landAfterSignIn = async (router: Router) => {
    try {
        // Capped, because it runs on the splash screen too: a slow network must cost the
        // welcome hub at worst, never a splash that does not end.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const journey = await Promise.race([
            getJourney(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 4000); }),
        ]).finally(() => clearTimeout(timer));
        router.replace((journey.showWelcome ? '/welcome' : '/(tabs)') as Href);
    } catch {
        router.replace('/(tabs)');
    }
};

/**
 * Open a step's destination, telling it where to come back to. The screens that honour
 * `returnTo` (the assessment, the package screen, the basket) send the person back to the hub
 * when they finish; the rest are ordinary screens and Back does the same job.
 */
export const openStep = (router: Router, route: string, returnTo?: string) => {
    if (!returnTo) {
        router.push(route as Href);
        return;
    }
    const join = route.includes('?') ? '&' : '?';
    router.push(`${route}${join}returnTo=${encodeURIComponent(returnTo)}` as Href);
};

export const STEP_ICON: Record<StepKey, string> = {
    profile: 'person-outline',
    package: 'cube-outline',
    results: 'document-text-outline',
    device: 'watch-outline',
};

export const KIT_ICON: Record<ComponentKind, string> = {
    blood: 'water-outline',
    dna: 'git-branch-outline',
    bracelet: 'watch-outline',
};

/** "6 nights · 12 activities · 2 results", leaving out the zeroes. Null when there is nothing. */
export const learnedLine = (learned: Journey['learned']) => {
    const parts: string[] = [];
    const n = (count: number, one: string, many: string) => {
        if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`);
    };
    n(learned.nights, 'night of sleep', 'nights of sleep');
    n(learned.activities, 'activity', 'activities');
    n(learned.results, 'result', 'results');
    return parts.length ? parts.join(' · ') : null;
};
