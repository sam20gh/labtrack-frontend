/**
 * Fail fast, and legibly, on the wrong Node version.
 *
 * React Native 0.81 (Expo SDK 54) needs Node 20+, and this machine's default is 18. What
 * happens without this check is not a version error — it is:
 *
 *     TypeError: configs.toReversed is not a function
 *         at mergeConfig (node_modules/metro-config/src/loadConfig.js:179:35)
 *
 * `Array.prototype.toReversed` is ES2023 and simply does not exist on Node 18, so Metro
 * dies deep inside config loading and the stack points at `metro.config.js`, which is
 * stock boilerplate and entirely innocent. Nothing in that message says "wrong Node".
 *
 * It bites hardest on `eas update`, because that exports the bundle **locally**.
 * `eas build` runs on Expo's servers and does not care what Node is installed here — so
 * the build can succeed and the update fail on the same machine, minutes apart, which is
 * exactly the kind of asymmetry that sends someone hunting through their Metro config.
 */
const MINIMUM_MAJOR = 20;

const major = Number(process.versions.node.split('.')[0]);

if (Number.isFinite(major) && major < MINIMUM_MAJOR) {
    console.error(
        `\n  LabTrack needs Node ${MINIMUM_MAJOR} or newer — you are on ${process.version}.\n\n` +
        '  Run `nvm use` in this directory (.nvmrc pins the right version), then try again.\n\n' +
        '  Note: `nvm use 20 & <command>` does NOT work. The single "&" backgrounds nvm,\n' +
        '  so it never changes the shell that runs your command. Use `&&`.\n'
    );
    process.exit(1);
}
