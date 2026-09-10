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
 * every one of these files and prints the full count. Today that is 3334
 * violations across 157 files. It was 819 across 115 until the rule learned to
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
  'src/features/inventory/ManagerInventoryRow.tsx',
  // app (2 files, 9)
  'app/_layout.tsx',
  'app/suspended.tsx',
  // app/(auth) (3 files, 125)
  'app/(auth)/complete-profile.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/signup.tsx',
  // app/(manager) (12 files, 1289)
  'app/(manager)/employee-reminders-delivery.tsx',
  'app/(manager)/employee-reminders-recurring.tsx',
  'app/(manager)/employee-reminders-settings.tsx',
  'app/(manager)/employee-reminders.tsx',
  'app/(manager)/export-fish-order.tsx',
  'app/(manager)/fulfillment-confirmation.tsx',
  'app/(manager)/fulfillment-history-detail.tsx',
  'app/(manager)/fulfillment-history.tsx',
  'app/(manager)/fulfillment.tsx',
  'app/(manager)/inventory.tsx',
  'app/(manager)/orders.tsx',
  'app/(manager)/profile.tsx',
  // app/(manager)/manager-settings (4 files, 70)
  'app/(manager)/manager-settings/access-codes.tsx',
  'app/(manager)/manager-settings/export-format.tsx',
  'app/(manager)/manager-settings/profile.tsx',
  'app/(manager)/manager-settings/user-management.tsx',
  // app/settings (6 files, 43)
  'app/settings/about-support.tsx',
  'app/settings/display-accessibility.tsx',
  'app/settings/notifications-debug.tsx',
  'app/settings/notifications.tsx',
  'app/settings/profile.tsx',
  'app/settings/reminders.tsx',
  // src/components (15 files, 163)
  'src/components/BrowseCategoryScroller.tsx',
  'src/components/CategoryFilter.tsx',
  'src/components/ConfirmLocationBottomSheet.tsx',
  'src/components/EmptyStateCard.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/components/FloatingLocationSelector.tsx',
  'src/components/HeaderCartButton.tsx',
  'src/components/IdentityHeader.tsx',
  'src/components/InventoryItemCard.tsx',
  'src/components/ItemActionSheet.tsx',
  'src/components/LocationSelectorButton.tsx',
  'src/components/OrderCard.tsx',
  'src/components/QrScannerModal.tsx',
  'src/components/SectionHeader.tsx',
  'src/components/StatusFilter.tsx',
  // src/components/navigation (3 files, 13)
  'src/components/navigation/FloatingPillTabBar.tsx',
  'src/components/navigation/tabBarConfig.ts',
  'src/components/navigation/TabButton.tsx',
  // src/components/settings (10 files, 74)
  'src/components/settings/ChangeCredentialSheet.tsx',
  'src/components/settings/ChangePasswordModal.tsx',
  'src/components/settings/ExpandableSection.tsx',
  'src/components/settings/MultiOptionToggle.tsx',
  'src/components/settings/ReminderListItem.tsx',
  'src/components/settings/ReminderModal.tsx',
  'src/components/settings/SettingsRow.tsx',
  'src/components/settings/SettingsScreenLayout.tsx',
  'src/components/settings/SettingToggle.tsx',
  'src/components/settings/TimePickerRow.tsx',
  // src/components/tuna-specialist (3 files, 29)
  'src/components/tuna-specialist/ConversationHistory.tsx',
  'src/components/tuna-specialist/DebugPanel.tsx',
  'src/components/tuna-specialist/SoundVisualizer.tsx',
  // src/features/auth (7 files, 48)
  'src/features/auth/InviteHelloScreen.tsx',
  'src/features/auth/NameSignInScreen.tsx',
  'src/features/auth/ReadyScreen.tsx',
  'src/features/auth/SecureAppScreen.tsx',
  'src/features/auth/SecurePasswordScreen.tsx',
  'src/features/auth/SecurePinScreen.tsx',
  'src/features/auth/WelcomeScreen.tsx',
  // src/features/auth/components (4 files, 10)
  'src/features/auth/components/AuthPrimaryButton.tsx',
  'src/features/auth/components/LegalFooter.tsx',
  'src/features/auth/components/PinPad.tsx',
  'src/features/auth/components/StepProgress.tsx',
  // src/features/browse (2 files, 37)
  'src/features/browse/BrowseInventoryScreenView.tsx',
  'src/features/browse/BrowseItemRow.tsx',
  // src/features/employeeSettings (2 files, 40)
  'src/features/employeeSettings/EmployeeProfileScreen.tsx',
  'src/features/employeeSettings/EmployeeSettingsScreen.tsx',
  // src/features/employeeSettings/components (2 files, 9)
  'src/features/employeeSettings/components/AboutLegalSheet.tsx',
  'src/features/employeeSettings/components/SettingsCardRow.tsx',
  // src/features/fulfillment/components (12 files, 121)
  'src/features/fulfillment/components/FulfillmentConfirmItemRow.tsx',
  'src/features/fulfillment/components/FulfillmentExpandedSupplierItems.tsx',
  'src/features/fulfillment/components/FulfillmentHeader.tsx',
  'src/features/fulfillment/components/FulfillmentOrderLaterCard.tsx',
  'src/features/fulfillment/components/FulfillmentReminderBanner.tsx',
  'src/features/fulfillment/components/FulfillmentSupplierCard.tsx',
  'src/features/fulfillment/components/FulfillmentSuppliersCard.tsx',
  'src/features/fulfillment/components/FulfillmentSupplierSectionLabel.tsx',
  'src/features/fulfillment/components/OrderLaterAddToSheet.tsx',
  'src/features/fulfillment/components/OrderLaterScheduleModal.tsx',
  'src/features/fulfillment/components/QuantityExportSelector.tsx',
  'src/features/fulfillment/components/SupplierPickerBottomSheet.tsx',
  // src/features/fulfillment/sendAll (1 file, 25)
  'src/features/fulfillment/sendAll/SendAllScreen.tsx',
  // src/features/ordering (17 files, 501)
  'src/features/ordering/ComposerSuggestionPills.tsx',
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
  'src/features/ordering/QuickOrderUserMessage.tsx',
  'src/features/ordering/QuickOrderWelcomeMessage.tsx',
  'src/features/ordering/QuickSearchScreenView.tsx',
  'src/features/ordering/RollingSpectrogram.tsx',
  'src/features/ordering/UnitSegmentedControl.tsx',
  // src/features/ordering/quickOrderConfig (5 files, 99)
  'src/features/ordering/quickOrderConfig/AliasesTab.tsx',
  'src/features/ordering/quickOrderConfig/ExampleEditorModal.tsx',
  'src/features/ordering/quickOrderConfig/ExamplesTab.tsx',
  'src/features/ordering/quickOrderConfig/ImportOrderHistoryTab.tsx',
  'src/features/ordering/quickOrderConfig/WeeklyLearningTab.tsx',
  // src/features/settings (1 file, 11)
  'src/features/settings/SupplierContactsScreen.tsx',
  // src/features/smart (1 file, 11)
  'src/features/smart/SmartOrderScreen.tsx',
  // src/features/team (6 files, 75)
  'src/features/team/DefaultsScreen.tsx',
  'src/features/team/InviteLinkReadyScreen.tsx',
  'src/features/team/InviteScreen.tsx',
  'src/features/team/MemberDetailScreen.tsx',
  'src/features/team/PreviewAsScreen.tsx',
  'src/features/team/TeamScreen.tsx',
  // src/features/team/components (2 files, 17)
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
