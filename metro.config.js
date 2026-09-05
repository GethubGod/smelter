const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = withNativeWind(getDefaultConfig(__dirname), {
  input: "./global.css",
});

// Harden Metro's image parser against the image-size ICNS/JXL/HEIF infinite
// loop advisories. See metro.transformer.js for the detail.
//
// Metro parses assets in its transform worker processes, so the mitigation has
// to load there, not just here. We insert metro.transformer.js as the
// transformerPath and hand it the transformer it replaced. Worker processes
// inherit process.env, so they resolve the same upstream module.
//
// Read transformerPath after withNativeWind: nativewind swaps in its own
// transformer, and we must chain to whatever ends up configured.
// Keep this env var name in sync with metro.transformer.js.
process.env.SMELTER_METRO_UPSTREAM_TRANSFORMER = config.transformerPath;
config.transformerPath = require.resolve("./metro.transformer.js");

// Load it here too, after the env var is set, so this process gets the same
// protection and so an in-band transform reuses the fully initialised module.
require("./metro.transformer.js");

module.exports = config;
