/**
 * Drift report entry point, used by `npm run lint:drift`.
 *
 * `eslint.config.js` silences smelter/no-design-drift on the pre-contract
 * allowlist, because `npm run lint` runs under --max-warnings 0. This config
 * turns the rule back on, as a warning, for every file it covers, so the
 * remaining backlog stays visible and countable while sweeps #33 to #36 burn
 * it down.
 *
 * It carries the drift rule and nothing else: no expo config, no import
 * plugin. The number it prints is the whole point.
 *
 * Delete this file, and the `lint:drift` script, when DRIFT_ALLOWLIST is empty.
 */
const { defineConfig } = require('eslint/config');
const {
  plugin: smelter,
  DRIFT_FILES,
  DRIFT_EXEMPT,
} = require('./eslint-rules/no-design-drift');

module.exports = defineConfig([
  { ignores: ['.expo/**', '.claude/**', 'web/**', 'marketing/**'] },
  {
    files: DRIFT_FILES,
    ignores: DRIFT_EXEMPT,
    // This config carries one rule, so eslint-disable comments naming any
    // other rule would error with "definition not found". The report wants the
    // raw count anyway.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { smelter },
    rules: {
      'smelter/no-design-drift': 'warn',
    },
  },
]);
