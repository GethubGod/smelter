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
  // app (2 files, 9)
  'app/_layout.tsx',
  'app/suspended.tsx',
  // app/(auth) (3 files, 125)
  'app/(auth)/complete-profile.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/signup.tsx',
  // app/(manager) (1 file, 6): full-screen pageSheet forms (edit/move/add
  // stock). Sheet/BottomSheetShell is a fixed-height bottom sheet with no
  // internal scroll container; hosting these here would drop the scrolling
  // form body. Needs a full-screen variant of the primitive, see #35.
  'app/(manager)/inventory.tsx',
  // app/(manager)/manager-settings (4 files, 70)
  'app/(manager)/manager-settings/access-codes.tsx',
  'app/(manager)/manager-settings/export-format.tsx',
  'app/(manager)/manager-settings/profile.tsx',
  'app/(manager)/manager-settings/user-management.tsx',
  // app/(tabs) (2 files, 45)
  'app/(tabs)/draft.tsx',
  'app/(tabs)/quick-order.tsx',
  // app/orders (2 files, 116)
  'app/orders/\\[id\\].tsx',
  'app/orders/history.tsx',
  // app/settings (6 files, 43)
  'app/settings/about-support.tsx',
  'app/settings/display-accessibility.tsx',
  'app/settings/notifications-debug.tsx',
  'app/settings/notifications.tsx',
  'app/settings/profile.tsx',
  'app/settings/reminders.tsx',
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
  // src/components/tuna-specialist (1 file, 2): full-screen pageSheet
  // history view, same primitive gap as the inventory forms above, see #35.
  'src/components/tuna-specialist/ConversationHistory.tsx',
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
  // src/features/cart (3 files, 84)
  'src/features/cart/CartScreenView.tsx',
  'src/features/cart/EmptyCartReorderState.tsx',
  'src/features/cart/OrderSubmissionConfirmationOverlay.tsx',
  // src/features/employeeSettings (2 files, 40)
  'src/features/employeeSettings/EmployeeProfileScreen.tsx',
  'src/features/employeeSettings/EmployeeSettingsScreen.tsx',
  // src/features/employeeSettings/components (2 files, 9)
  'src/features/employeeSettings/components/AboutLegalSheet.tsx',
  'src/features/employeeSettings/components/SettingsCardRow.tsx',
  // src/features/ordering (4 files, 8): two keyboard-aware bottom sheets
  // (QuickOrderItemEditModal, QuickOrderQuantitySheet) that roll their own
  // KeyboardAvoidingView + drag-to-dismiss, which BottomSheetShell does not
  // support; and one full-screen pageSheet form
  // (QuickOrderReviewQueueScreen's edit-and-approve modal, QuickSearchScreenView's
  // quick-create modal). Same primitive gap as the inventory forms above, see #35.
  'src/features/ordering/QuickOrderItemEditModal.tsx',
  'src/features/ordering/QuickOrderQuantitySheet.tsx',
  'src/features/ordering/QuickOrderReviewQueueScreen.tsx',
  'src/features/ordering/QuickSearchScreenView.tsx',
  // src/features/ordering/quickOrderConfig (1 file, 2): full-screen pageSheet
  // form, same gap, see #35.
  'src/features/ordering/quickOrderConfig/ExampleEditorModal.tsx',
  // src/features/settings (1 file, 11)
  'src/features/settings/SupplierContactsScreen.tsx',
  // src/features/simpleOrder (2 files, 20)
  'src/features/simpleOrder/HistoryScreen.tsx',
  'src/features/simpleOrder/SimpleOrderScreen.tsx',
  // src/features/simpleOrder/components (12 files, 126)
  'src/features/simpleOrder/components/ChecklistItemRow.tsx',
  'src/features/simpleOrder/components/ChecklistSettingsSheet.tsx',
  'src/features/simpleOrder/components/ChecklistToast.tsx',
  'src/features/simpleOrder/components/ConfirmOrderSheet.tsx',
  'src/features/simpleOrder/components/DirectSendQueue.tsx',
  'src/features/simpleOrder/components/NoteSheet.tsx',
  'src/features/simpleOrder/components/OrderDayReminderSheet.tsx',
  'src/features/simpleOrder/components/PinnedOrderBar.tsx',
  'src/features/simpleOrder/components/QuantityCardSheet.tsx',
  'src/features/simpleOrder/components/QuickActionsSheet.tsx',
  'src/features/simpleOrder/components/RecentOrdersSheet.tsx',
  'src/features/simpleOrder/components/VoiceAddSheet.tsx',
  // src/features/simpleOrder/receiving (1 file, 15)
  'src/features/simpleOrder/receiving/ReceiveDeliveryScreen.tsx',
  // src/features/smart (1 file, 11)
  'src/features/smart/SmartOrderScreen.tsx',
  // src/features/stock-check (3 files, 19)
  'src/features/stock-check/PastChecksScreen.tsx',
  'src/features/stock-check/StockCheckScreenView.tsx',
  'src/features/stock-check/StockHomeScreen.tsx',
  // src/features/stock-check/components (8 files, 57)
  'src/features/stock-check/components/LocationSwitcherDropdown.tsx',
  'src/features/stock-check/components/SetStockBottomSheet.tsx',
  'src/features/stock-check/components/StationCard.tsx',
  'src/features/stock-check/components/StationPickerBottomSheet.tsx',
  'src/features/stock-check/components/StockCheckHeader.tsx',
  'src/features/stock-check/components/StockCheckItemCard.tsx',
  'src/features/stock-check/components/StockCheckProgressBar.tsx',
  'src/features/stock-check/components/StorageAreaFilterBar.tsx',
  // src/features/stock-check/components/wheel-picker (2 files, 3)
  'src/features/stock-check/components/wheel-picker/WheelPicker.tsx',
  'src/features/stock-check/components/wheel-picker/WheelPickerGroup.tsx',
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
