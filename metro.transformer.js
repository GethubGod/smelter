/**
 * Metro transformer wrapper that hardens the bundler's image parser.
 *
 * Advisories GHSA-w3rx-r6r6-pgpr (ICNS) and GHSA-5p2g-fcmc-qvqq (JXL/HEIF)
 * describe infinite loops in image-size, which Metro uses to read asset
 * dimensions. image-size detects a file's type from its content, not its
 * extension, so a malformed ICNS/JXL/HEIF file renamed to .png still reaches
 * the vulnerable decoder and can hang a developer or CI bundling process.
 *
 * Metro parses assets inside its transform worker processes, so calling
 * disableTypes() in metro.config.js alone leaves the workers unprotected.
 * Metro requires this module in every worker (it is the configured
 * transformerPath), so the call below runs everywhere assets are parsed.
 * An asset plugin would run after image-size has already parsed the file.
 *
 * Smelter ships no ICNS, JXL or HEIF assets, so rejecting those types costs
 * nothing. A disabled type raises "disabled file type: <type>" before the
 * affected parser runs.
 */

const imageSize = require("image-size");

const DISABLED_IMAGE_TYPES = ["icns", "jxl", "jxl-stream", "heif"];

// Name of the env var metro.config.js uses to hand us the real transformer.
// Keep this string in sync with metro.config.js.
const UPSTREAM_ENV_VAR = "SMELTER_METRO_UPSTREAM_TRANSFORMER";

imageSize.disableTypes(DISABLED_IMAGE_TYPES);

const upstreamPath = process.env[UPSTREAM_ENV_VAR];

if (!upstreamPath) {
  throw new Error(
    `${UPSTREAM_ENV_VAR} is not set, so the real Metro transformer cannot be ` +
      `resolved. metro.config.js sets it before handing this file to Metro as ` +
      `transformerPath. Start the bundler through metro.config.js.`
  );
}

// Delegate every transformer method to the upstream transformer that
// metro.config.js replaced. Only the image-size hardening above is ours.
module.exports = require(upstreamPath);
