/**
 * The activity tracker's illustrations, ported verbatim from `Design/activity.svg`.
 *
 * Each file is generated rather than drawn: the export's own elements for one spot, in
 * paint order, with flat fills mapped onto `Palette` and the export's own viewBox origin
 * kept, so a re-issued export diffs against the file directly. It is the treatment
 * `components/errors/art` and `components/sleep/*Illustration` record, for the same
 * reason — a redrawn likeness drifts, which is what `WelcomeIllustration` did.
 *
 * | Art             | Frame | Where the kit draws it            | Where it is used                 |
 * |-----------------|-------|-----------------------------------|----------------------------------|
 * | RunnerHeroArt   | 0     | onboarding hero                   | dashboard first-run card         |
 * | CyclistArt      | 6     | empty Activity History card       | a day with no activities         |
 * | TargetArt       | 6     | empty Activity Goal card          | no weekly goal yet               |
 * | FlexArt         | 6     | empty AI Recommendations card     | no exercise advice in the plan   |
 * | NoMatchArt      | 11    | "Whoops! Activity Not Found"      | history search with no results   |
 * | GoalRunnerArt   | 42    | the Goal Progress card            | the weekly goal card             |
 *
 * The colour map. Two entries are not the identity, and both are deliberate: the app owns
 * one secondary grey and one violet-100, and a third grey the product never uses would be
 * a stray token.
 *
 * | export     | token                     |
 * |------------|---------------------------|
 * | `#1F2937`  | `Palette.text`            |
 * | `#4B5563`  | `Palette.textSecondary`   | ← `#6B7280`, one step lighter
 * | `#F3F4F6`  | `Palette.borderLight`     |
 * | `#E5E7EB`  | `Palette.border`          |
 * | `#D1D5DB`  | `Palette.borderStrong`    |
 * | `#F9FAFB`  | `Palette.surface`         |
 * | `#EDE9FE`  | `Palette.primarySurface`  | ← `#F3E8FF`, the app's violet tint
 * | `#C4B5FD`  | `Palette.primaryPale`     |
 * | `#7C3AED`  | `Palette.primary`         |
 * | `white`    | `Palette.white`           |
 *
 * The streak badge (frame 18) lives in `components/metric/StreakCard.tsx` rather than here,
 * because its digit is data: the export's "8" is outlined type, and a badge that always
 * says 8 is a picture of somebody else's streak.
 *
 * Not ported: frame 27's hiker (it illustrates route planning, which is not built), frame
 * 44's confetti and frame 49's AI scene (a modal and a celebration nothing routes to). Art
 * nothing renders is a maintenance obligation with no screen behind it.
 *
 * Every illustration is decoration and is hidden from screen readers: it carries nothing
 * the words beside it do not.
 */
export { default as RunnerHeroArt, RUNNER_HERO_ART } from './RunnerHeroArt';
export { default as CyclistArt, CYCLIST_ART } from './CyclistArt';
export { default as TargetArt, TARGET_ART } from './TargetArt';
export { default as FlexArt, FLEX_ART } from './FlexArt';
export { default as NoMatchArt, NO_MATCH_ART } from './NoMatchArt';
export { default as GoalRunnerArt, GOAL_RUNNER_ART } from './GoalRunnerArt';
