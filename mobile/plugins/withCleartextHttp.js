/*
 * Expo config plugin: allow plain-HTTP toward the LAN bridge.
 * The release manifest otherwise blocks cleartext (Android 9+), which
 * silently breaks LAN-direct and drops the app back to the tunnel.
 * android/ is gitignored (prebuild regenerates it), so this flag must live
 * here — not as a hand-edit in AndroidManifest.xml.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withCleartextHttp(config) {
  return withAndroidManifest(config, (modConfig) => {
    const app = modConfig.modResults.manifest.application[0];
    app.$["android:usesCleartextTraffic"] = "true";
    return modConfig;
  });
};
