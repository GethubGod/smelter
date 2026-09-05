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
 * every one of these files and prints the full count. Today that is 819
 * violations across 115 files.
 *
 * Sweeps #33 to #36 delete their own entries as they land, and check the
 * number with `npm run lint:drift`. When the array is empty, delete this whole
 * config block, the `lint:drift` script and `eslint.drift.config.js`. Do not
 * add to it.
 */
const DRIFT_ALLOWLIST = [
  // app/(auth) (2)
  'app/(auth)/login.tsx',
  'app/(auth)/signup.tsx',
  // app/(manager) (9)
  'app/(manager)/employee-reminders-recurring.tsx',
  'app/(manager)/employee-reminders.tsx',
  'app/(manager)/fulfillment-confirmation.tsx',
  'app/(manager)/fulfillment.tsx',
  'app/(manager)/inventory.tsx',
  'app/(manager)/manager-settings/access-codes.tsx',
  'app/(manager)/manager-settings/profile.tsx',
  'app/(manager)/manager-settings/user-management.tsx',
  'app/(manager)/profile.tsx',
  // app/(tabs) (1)
  'app/(tabs)/quick-order.tsx',
  // app/_layout.tsx (1)
  'app/_layout.tsx',
  // app/orders (1)
  'app/orders/\\[id\\].tsx',
  // app/settings (3)
  'app/settings/display-accessibility.tsx',
  'app/settings/notifications.tsx',
  'app/settings/profile.tsx',
  // src/components/CategoryFilter.tsx (1)
  'src/components/CategoryFilter.tsx',
  // src/components/ConfirmLocationBottomSheet.tsx (1)
  'src/components/ConfirmLocationBottomSheet.tsx',
  // src/components/ErrorBoundary.tsx (1)
  'src/components/ErrorBoundary.tsx',
  // src/components/FloatingLocationSelector.tsx (1)
  'src/components/FloatingLocationSelector.tsx',
  // src/components/HeaderCartButton.tsx (1)
  'src/components/HeaderCartButton.tsx',
  // src/components/IdentityHeader.tsx (1)
  'src/components/IdentityHeader.tsx',
  // src/components/InventoryItemCard.tsx (1)
  'src/components/InventoryItemCard.tsx',
  // src/components/ItemActionSheet.tsx (1)
  'src/components/ItemActionSheet.tsx',
  // src/components/QrScannerModal.tsx (1)
  'src/components/QrScannerModal.tsx',
  // src/components/StatusFilter.tsx (1)
  'src/components/StatusFilter.tsx',
  // src/components/navigation (3)
  'src/components/navigation/FloatingPillTabBar.tsx',
  'src/components/navigation/TabButton.tsx',
  'src/components/navigation/tabBarConfig.ts',
  // src/components/settings (4)
  'src/components/settings/ChangeCredentialSheet.tsx',
  'src/components/settings/ChangePasswordModal.tsx',
  'src/components/settings/ReminderModal.tsx',
  'src/components/settings/TimePickerRow.tsx',
  // src/components/tuna-specialist (3)
  'src/components/tuna-specialist/ConversationHistory.tsx',
  'src/components/tuna-specialist/DebugPanel.tsx',
  'src/components/tuna-specialist/SoundVisualizer.tsx',
  // src/features/auth (11)
  'src/features/auth/InviteHelloScreen.tsx',
  'src/features/auth/NameSignInScreen.tsx',
  'src/features/auth/ReadyScreen.tsx',
  'src/features/auth/SecureAppScreen.tsx',
  'src/features/auth/SecurePasswordScreen.tsx',
  'src/features/auth/SecurePinScreen.tsx',
  'src/features/auth/WelcomeScreen.tsx',
  'src/features/auth/components/AuthPrimaryButton.tsx',
  'src/features/auth/components/LegalFooter.tsx',
  'src/features/auth/components/PinPad.tsx',
  'src/features/auth/components/StepProgress.tsx',
  // src/features/browse (2)
  'src/features/browse/BrowseInventoryScreenView.tsx',
  'src/features/browse/BrowseItemRow.tsx',
  // src/features/cart (2)
  'src/features/cart/CartScreenView.tsx',
  'src/features/cart/OrderSubmissionConfirmationOverlay.tsx',
  // src/features/employeeSettings (3)
  'src/features/employeeSettings/EmployeeProfileScreen.tsx',
  'src/features/employeeSettings/EmployeeSettingsScreen.tsx',
  'src/features/employeeSettings/components/SettingsCardRow.tsx',
  // src/features/fulfillment (11)
  'src/features/fulfillment/components/FulfillmentConfirmItemRow.tsx',
  'src/features/fulfillment/components/FulfillmentExpandedSupplierItems.tsx',
  'src/features/fulfillment/components/FulfillmentHeader.tsx',
  'src/features/fulfillment/components/FulfillmentReminderBanner.tsx',
  'src/features/fulfillment/components/FulfillmentSupplierCard.tsx',
  'src/features/fulfillment/components/FulfillmentSupplierSectionLabel.tsx',
  'src/features/fulfillment/components/OrderLaterAddToSheet.tsx',
  'src/features/fulfillment/components/OrderLaterScheduleModal.tsx',
  'src/features/fulfillment/components/QuantityExportSelector.tsx',
  'src/features/fulfillment/components/SupplierPickerBottomSheet.tsx',
  'src/features/fulfillment/sendAll/SendAllScreen.tsx',
  // src/features/home (1)
  'src/features/home/HomeScreenView.tsx',
  // src/features/ordering (20)
  'src/features/ordering/NeedsInputActionButtons.tsx',
  'src/features/ordering/PreviousQuantitySuggestionCard.tsx',
  'src/features/ordering/QuantityStepper.tsx',
  'src/features/ordering/QuickOrderComposerBar.tsx',
  'src/features/ordering/QuickOrderConfigScreen.tsx',
  'src/features/ordering/QuickOrderItemEditModal.tsx',
  'src/features/ordering/QuickOrderItemRow.tsx',
  'src/features/ordering/QuickOrderListCard.tsx',
  'src/features/ordering/QuickOrderQuantitySheet.tsx',
  'src/features/ordering/QuickOrderReviewQueueScreen.tsx',
  'src/features/ordering/QuickOrderScreen.tsx',
  'src/features/ordering/QuickOrderWelcomeMessage.tsx',
  'src/features/ordering/QuickSearchScreenView.tsx',
  'src/features/ordering/RollingSpectrogram.tsx',
  'src/features/ordering/UnitSegmentedControl.tsx',
  'src/features/ordering/quickOrderConfig/AliasesTab.tsx',
  'src/features/ordering/quickOrderConfig/ExampleEditorModal.tsx',
  'src/features/ordering/quickOrderConfig/ExamplesTab.tsx',
  'src/features/ordering/quickOrderConfig/ImportOrderHistoryTab.tsx',
  'src/features/ordering/quickOrderConfig/WeeklyLearningTab.tsx',
  // src/features/simpleOrder (11)
  'src/features/simpleOrder/HistoryScreen.tsx',
  'src/features/simpleOrder/SimpleOrderScreen.tsx',
  'src/features/simpleOrder/components/ChecklistItemRow.tsx',
  'src/features/simpleOrder/components/ChecklistSettingsSheet.tsx',
  'src/features/simpleOrder/components/ChecklistToast.tsx',
  'src/features/simpleOrder/components/ConfirmOrderSheet.tsx',
  'src/features/simpleOrder/components/NoteSheet.tsx',
  'src/features/simpleOrder/components/PinnedOrderBar.tsx',
  'src/features/simpleOrder/components/QuantityCardSheet.tsx',
  'src/features/simpleOrder/components/QuickActionsSheet.tsx',
  'src/features/simpleOrder/components/VoiceAddSheet.tsx',
  // src/features/stock-check (9)
  'src/features/stock-check/StockCheckScreenView.tsx',
  'src/features/stock-check/components/LocationSwitcherDropdown.tsx',
  'src/features/stock-check/components/SetStockBottomSheet.tsx',
  'src/features/stock-check/components/StationCard.tsx',
  'src/features/stock-check/components/StationPickerBottomSheet.tsx',
  'src/features/stock-check/components/StockCheckHeader.tsx',
  'src/features/stock-check/components/StockCheckItemCard.tsx',
  'src/features/stock-check/components/StorageAreaFilterBar.tsx',
  'src/features/stock-check/components/wheel-picker/WheelPicker.tsx',
  // src/features/team (8)
  'src/features/team/DefaultsScreen.tsx',
  'src/features/team/InviteLinkReadyScreen.tsx',
  'src/features/team/InviteScreen.tsx',
  'src/features/team/MemberDetailScreen.tsx',
  'src/features/team/PreviewAsScreen.tsx',
  'src/features/team/TeamScreen.tsx',
  'src/features/team/components/InvitePreviewCard.tsx',
  'src/features/team/components/TeamUI.tsx',
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
