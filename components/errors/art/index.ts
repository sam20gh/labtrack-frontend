/**
 * The eight illustrations from `Design/errors.svg`, ported verbatim.
 *
 * Each file is the export's own paths for one frame, in paint order, with its flat fills
 * mapped onto `Palette` and the export's own viewBox origin kept — so a re-issued export
 * diffs against these files directly. That is the treatment `SleepIllustration`,
 * `SymptomIllustration` and `PredictIllustration` already record, and the reason for it is
 * the same: a redrawn likeness drifts, which is what `WelcomeIllustration` did.
 *
 * The colour map, and the two places it is not the identity:
 *
 * | export     | token                   |
 * |------------|-------------------------|
 * | `#1F2937`  | `Palette.text`          |
 * | `#F3F4F6`  | `Palette.borderLight`   |
 * | `#E5E7EB`  | `Palette.border`        |
 * | `#D1D5DB`  | `Palette.borderStrong`  |
 * | `white`    | `Palette.white`         |
 * | `#7C3AED`  | `Palette.primary`       |
 * | `#EF4444`  | `Palette.danger`        |
 *
 * `#D1D5DB` → `#CBD5E1` and `#EF4444` → `#DC2626` are the two shifts, and both are
 * intended: the app owns one mid-grey and one red, and a warning triangle drawn in a red
 * the rest of the product never uses is a second danger colour. Rendered side by side with
 * the export at 1× the ports are identical everywhere else — 0.000% of channel samples
 * differ by more than 16, and the 0.6% that do are that one triangle.
 *
 * Frames 8–10 of the export (the "+5 Turing Health Score", "250ml" and "30m appointment"
 * celebration screens) are deliberately **not** ported. They are full-bleed photographic
 * compositions rather than spot illustrations, they are a different surface from an error
 * state, and nothing in the app routes to them today. Porting art nothing renders is a
 * maintenance obligation with no screen behind it.
 */
export { default as NotFoundArt, NOT_FOUND_ART } from './NotFoundArt';
export { default as ServerErrorArt, SERVER_ERROR_ART } from './ServerErrorArt';
export { default as NoInternetArt, NO_INTERNET_ART } from './NoInternetArt';
export { default as MaintenanceArt, MAINTENANCE_ART } from './MaintenanceArt';
export { default as NotAllowedArt, NOT_ALLOWED_ART } from './NotAllowedArt';
export { default as FeatureLockedArt, FEATURE_LOCKED_ART } from './FeatureLockedArt';
export { default as UpdateRequiredArt, UPDATE_REQUIRED_ART } from './UpdateRequiredArt';
export { default as NoDataArt, NO_DATA_ART } from './NoDataArt';
