const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');
const {
  plugin: smelter,
  DRIFT_FILES,
  DRIFT_EXEMPT,
} = require('./eslint-rules/no-design-drift');

/** Paths ignored by every config in this file. */
const ROOT_IGNORES = [
  '.expo/**',
  '.claude/**',
  'supabase/.temp/**',
  'docs/mockups/**',
  'scripts/google-sheets-sync.js',
  'scripts/flood-test/**',
  'scripts/scratch_query.ts',
  'web/**',
  'marketing/**',
];

module.exports = defineConfig([
  { ignores: ROOT_IGNORES },
  expoConfig,
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  /**
   * The design contract, enforced with no exceptions.
   *
   * Sweeps #33 to #37 cleared the pre-contract backlog, so the allowlist that
   * used to silence this rule, the `lint:drift` report that counted what it
   * hid, and `eslint.drift.config.js` are all gone. `npm run lint` is the
   * whole story now. Do not reintroduce an exception list: fix the file, or
   * add the primitive it is missing to `src/components/ui`.
   */
  {
    files: DRIFT_FILES,
    ignores: DRIFT_EXEMPT,
    plugins: { smelter },
    rules: {
      'smelter/no-design-drift': 'error',
    },
  },
]);
