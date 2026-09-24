/**
 * What the runtime fingerprint is allowed to depend on.
 *
 * `app.json` sets `runtimeVersion.policy` to `fingerprint`, so an over-the-air update is
 * offered only to a build whose fingerprint matches **exactly**. The fingerprint hashes
 * `package.json` whole — including `scripts`, which have no native effect whatsoever. So
 * adding a one-line npm script silently invalidates OTA updates for every build already in
 * somebody's hands, and there is no error anywhere: the publish succeeds, the device asks
 * for a runtime the server has no update for, and it quietly keeps running its embedded
 * bundle. Reloading, restarting and clearing the cache all do nothing, because none of them
 * is the problem.
 *
 * That has already cost this project once. Adding a `types:check` script during the
 * shared-types work moved the Android fingerprint from `3f418423…` to `0aef125e…` and hid
 * two shipped features from the test device; reverting that single line reproduced the old
 * hash exactly. It is why `labtrack-frontend` still has no `types:check` script when the
 * backend and the portal both do.
 *
 * `SourceSkips.PackageJsonScriptsAll` is the durable fix. It costs one build to adopt —
 * applying it changes the fingerprint itself — which is why it is landing **with the
 * bracelet work**: that adds `react-native-ble-plx` and a local native module, so a new
 * build was already unavoidable. Paying the same cost twice would have been the only
 * alternative.
 *
 * After this, editing an npm script never breaks an update again.
 *
 * `ignorePaths` covers the second way a local machine drifts from EAS: **build output inside
 * `node_modules`**. The defaults ignore `android/build`, but `react-native-health-connect` also
 * ships an `android-expo` module, and a local `expo run:android` writes ~4 MB of Gradle output
 * into `android-expo/build`. That directory is hashed, so the local fingerprint stops matching
 * the one EAS computes from a clean install — "Runtime version calculated on local machine not
 * equal to runtime version calculated during build" — and an update published from that machine
 * would never reach the build. Verified 2026-09-24: with the folder, the package hashed to
 * `0844ecc2…`; without it, to EAS's `ea4f852a…`. Ignoring it makes both agree whether or not a
 * local build has run. The pattern is general because any library with a non-standard Android
 * module directory can do the same.
 */
const { SourceSkips } = require('@expo/fingerprint');

module.exports = {
    sourceSkips: SourceSkips.PackageJsonScriptsAll,
    ignorePaths: [
        '**/android-expo/build/**/*',
        '**/android-expo/.cxx/**/*',
    ],
};
