# LabTrack — mobile app

React Native 0.76 + Expo SDK 52 client for LabTrack. File-based routing via
[expo-router](https://docs.expo.dev/router/introduction), TypeScript, prebuild (bare)
workflow with committed `ios/` and `android/` directories.

The backend lives in a separate repo: `github.com/sam20gh/labtrack-backend`.

## Setup

```bash
npm install
npm start                 # expo start --dev-client
```

| Command | What it does |
|---|---|
| `npm start` | Metro with a dev client |
| `npx expo run:ios` | Build and run the iOS app locally |
| `npx expo run:android` | Build and run the Android app locally |
| `npm run lint` | `expo lint` |
| `npm test` | `jest --watchAll` — one snapshot test exists |
| `npx tsc --noEmit` | Typecheck; ~36 pre-existing errors, not wired into CI |

`npx expo prebuild` regenerates `ios/` and `android/` and will overwrite local native
edits — both directories are committed on purpose.

## Pointing at a backend

`constants/config.ts` is the only switch; there is no env-var mechanism.

```ts
export const API_URL = 'https://labtrack-backend.onrender.com/api';  // prod (active)
// export const API_URL = 'http://localhost:5002/api';               // local
```

## Structure

```
app/
  _layout.tsx            Root Stack, starts at SplashScreen
  SplashScreen.tsx       2.5s splash, then → (tabs) | onboarding | login
  onboarding.tsx         Sets hasSeenOnboarding
  (auth)/loginscreen.tsx POST /users/login — sends the email as `username`
  signup.tsx
  forgot-password.tsx    → reset-password-{email,sms,2fa} → password-reset-sent
  (tabs)/
    index.tsx            Home: profile, latest test, products, AI feedback, plan creation
    professionals.tsx    Professional directory
    orders.tsx           Product catalogue
    results.tsx          Test result list
    ProfileScreen.tsx    Profile and logout
  health-assessment/     23-screen questionnaire, index → … → complete
  myplans.tsx            Health-plan timeline grouped by year
  TestDetails.tsx  ProductDetails.jsx  professionalDetails.tsx  users.tsx
components/              Shared UI (Header, Themed*, ui/*)
constants/               config.ts (API_URL), Colors.ts
hooks/                   useColorScheme, useThemeColor
```

## Conventions

- **Import alias:** `@/` resolves to the project root — `@/constants/config`.
- **Auth storage:** AsyncStorage keys `userId`, `authToken`, `keepSignedIn`,
  `hasSeenOnboarding`. On 401/403, `router.replace('/(auth)/loginscreen')`.
- **Data fetching:** `useFocusEffect(useCallback(() => { fetchData(); }, []))` from
  `@react-navigation/native` for anything that can go stale on return.
- **Colors:** `#FF385C` is the legacy accent (tab bar, splash); `#7C3AED` purple is used
  throughout onboarding and the health assessment. `constants/Colors.ts` is the unmodified
  Expo template palette, used only by `ThemedText` / `ThemedView`.
- Use `.tsx` for new files. `app/ProductDetails.jsx` is the only remaining `.jsx`.

## Health-assessment flow

The 23 screens pass state **entirely through router params** — each reads
`useLocalSearchParams()` and forwards `{ ...params, newKey: value }`. Nothing is persisted
until `complete.tsx`, which sends `PUT /users/:id` followed by
`PUT /users/:id/health-assessment`.

A mismatched param name therefore drops data with no error. Several mismatches exist today —
read `docs/KNOWN-ISSUES.md` in the LabTrack workspace before adding or renaming a step.

## Builds

```bash
eas build --platform android --profile staging
eas build --platform ios --profile production
```

`development`, `preview`, and `staging` profiles publish to the `staging` channel;
`production` publishes to `production`. OTA updates are configured in `app.json`
(`runtimeVersion` `1.0.0`).

## Further reading

These live in the LabTrack workspace directory that contains this repo, not in this repo
itself:

- `CLAUDE.md` — full architecture and conventions across both repos
- `docs/API.md` — backend endpoint reference
- `docs/KNOWN-ISSUES.md` — verified defects
