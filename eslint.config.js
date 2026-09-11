const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');
const {
  plugin: smelter,
  DRIFT_FILES,
  DRIFT_EXEMPT,
} = require('./eslint-rules/no-design-drift');

/** Paths ignored by every config in this file, including the drift entry point. */
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

/**
 * Files that predate the contract.
 *
 * The rule is silenced on these, not downgraded: `npm run lint` runs under
 * --max-warnings 0, so a warning here would break CI. Anything not on this
 * list, including every new file, still fails outright.
 *
 * The backlog is not hidden. `npm run lint:drift` turns the rule back on for
 * every one of these files and prints the full count. Today that is 79
 * violations across 12 files. It was 819 across 115 until the rule learned to
 * see numbers passed through the scaling helpers (`ds.fontSize(17)`) and
 * NativeWind utilities (`bg-gray-50`, `text-lg`, `rounded-xl`); those were
 * always drift, they were simply invisible.
 *
 * Sweeps #33 to #36 delete their own entries as they land, and check the
 * number with `npm run lint:drift`. When the array is empty, delete this whole
 * config block, the `lint:drift` script and `eslint.drift.config.js`. Do not
 * add to it.
 */
const DRIFT_ALLOWLIST = [
  // app (1 file, 2)
  'app/_layout.tsx',
  // app/(manager) (1 file, 6)
  'app/(manager)/inventory.tsx',
  // src/components/tuna-specialist (1 file, 2)
  'src/components/tuna-specialist/ConversationHistory.tsx',
  // src/features/browse (2 files, 37)
  'src/features/browse/BrowseInventoryScreenView.tsx',
  'src/features/browse/BrowseItemRow.tsx',
  // src/features/ordering (4 files, 8)
  'src/features/ordering/QuickOrderItemEditModal.tsx',
  'src/features/ordering/QuickOrderQuantitySheet.tsx',
  'src/features/ordering/QuickOrderReviewQueueScreen.tsx',
  'src/features/ordering/QuickSearchScreenView.tsx',
  // src/features/ordering/quickOrderConfig (1 file, 2)
  'src/features/ordering/quickOrderConfig/ExampleEditorModal.tsx',
  // src/features/settings (1 file, 11)
  'src/features/settings/SupplierContactsScreen.tsx',
  // src/features/smart (1 file, 11)
  'src/features/smart/SmartOrderScreen.tsx',
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
  {
    files: DRIFT_FILES,
    ignores: DRIFT_EXEMPT,
    plugins: { smelter },
    rules: {
      'smelter/no-design-drift': 'error',
    },
  },
  {
    files: DRIFT_ALLOWLIST,
    rules: {
      'smelter/no-design-drift': 'off',
    },
  },
]);
