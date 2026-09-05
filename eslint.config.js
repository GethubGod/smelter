const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

/* ────────────────────────────────────────────────────────────────────
 * smelter/no-design-drift
 *
 * Enforces the approved UI contract (docs/mockups/ui-contract/index.html).
 * Screens compose the primitives in src/components/ui out of the tokens in
 * src/theme/tokens.ts. They do not write colours, sizes, radii or their own
 * loading and modal hosts.
 * ──────────────────────────────────────────────────────────────────── */

/** Whole-string colours: #abc, #abcd, #aabbcc, #aabbccdd. */
const EXACT_HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** A colour embedded in a longer string, for example a gradient stop list. */
const EMBEDDED_HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RGB_FUNCTION = /\brgba?\s*\(/;

/** The three weights the contract keeps. 500, 800 and 900 are gone. */
const ALLOWED_FONT_WEIGHTS = new Set(['400', '600', '700', 'normal', 'bold']);

const RADIUS_PROPERTIES = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
]);

/** Components that may only be rendered by their designated single host. */
const HOSTED_COMPONENTS = new Set(['ActivityIndicator', 'Modal']);

function propertyName(node) {
  if (node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal') return String(node.key.value);
  return null;
}

/** Reads a numeric value through a leading minus sign. */
function numericValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-') return numericValue(node.argument);
  return null;
}

const noDesignDrift = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Use the approved tokens and primitives instead of colour, type, radius and host literals.',
    },
    schema: [],
    messages: {
      hex: 'Hex colour "{{value}}". Import a colour from @/theme/tokens instead.',
      rgb: 'rgb()/rgba() colour "{{value}}". Import a colour from @/theme/tokens instead.',
      fontSize:
        'Numeric fontSize {{value}}. Use typeScale from @/theme/tokens (display, title, body, secondary, caption).',
      radius:
        'Numeric {{name}} {{value}}. Use radius from @/theme/tokens (pill, card, control, sheet).',
      fontWeight:
        'fontWeight "{{value}}". The contract keeps 400, 600 and 700 only; use weight from @/theme/tokens.',
      host:
        '<{{name}}> is hosted once, in {{host}}. Use the {{primitive}} primitive from @/components/ui.',
      hostImport:
        '{{name}} is hosted once, in {{host}}. Use the {{primitive}} primitive from @/components/ui.',
    },
  },
  create(context) {
    function reportHosted(node, name, messageId) {
      context.report({
        node,
        messageId,
        data:
          name === 'Modal'
            ? { name, host: 'BottomSheetShell', primitive: 'Sheet' }
            : { name, host: 'LoadingIndicator', primitive: 'Loading' },
      });
    }

    function checkString(node, raw) {
      if (typeof raw !== 'string') return;
      if (EXACT_HEX.test(raw.trim()) || EMBEDDED_HEX.test(raw)) {
        context.report({ node, messageId: 'hex', data: { value: raw } });
        return;
      }
      if (RGB_FUNCTION.test(raw)) {
        context.report({ node, messageId: 'rgb', data: { value: raw } });
      }
    }

    return {
      Literal(node) {
        checkString(node, node.value);
      },
      TemplateElement(node) {
        checkString(node, node.value.cooked);
      },
      Property(node) {
        const name = propertyName(node);
        if (!name) return;

        if (name === 'fontSize') {
          const value = numericValue(node.value);
          if (value !== null) {
            context.report({ node, messageId: 'fontSize', data: { value } });
          }
          return;
        }

        if (RADIUS_PROPERTIES.has(name)) {
          const value = numericValue(node.value);
          if (value !== null) {
            context.report({ node, messageId: 'radius', data: { name, value } });
          }
          return;
        }

        if (name === 'fontWeight') {
          const literal = node.value.type === 'Literal' ? String(node.value.value) : null;
          if (literal !== null && !ALLOWED_FONT_WEIGHTS.has(literal)) {
            context.report({ node, messageId: 'fontWeight', data: { value: literal } });
          }
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        if (!HOSTED_COMPONENTS.has(node.name.name)) return;
        reportHosted(node.name, node.name.name, 'host');
      },
      ImportDeclaration(node) {
        if (node.source.value !== 'react-native') return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          if (specifier.imported.type !== 'Identifier') continue;
          if (!HOSTED_COMPONENTS.has(specifier.imported.name)) continue;
          reportHosted(specifier, specifier.imported.name, 'hostImport');
        }
      },
    };
  },
};

const smelter = { rules: { 'no-design-drift': noDesignDrift } };

/**
 * Files that predate the contract. The rule reports them as warnings so the
 * build stays green while sweeps #33 to #36 run; anything not on this list,
 * including every new file, fails outright.
 *
 * Sweeps delete their own entries as they land. When the list is empty, delete
 * the whole block. Do not add to it.
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
  {
    ignores: [
      '.expo/**',
      '.claude/**',
      'supabase/.temp/**',
      'docs/mockups/**',
      'scripts/google-sheets-sync.js',
      'scripts/flood-test/**',
      'scripts/scratch_query.ts',
      'web/**',
      'marketing/**',
    ],
  },
  expoConfig,
  {
    files: ['supabase/functions/**/*.ts'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      // The tokens and the primitives are where the literals are allowed to live.
      'src/theme/**',
      'src/components/ui/**',
      // The two designated hosts.
      'src/components/BottomSheetShell.tsx',
      'src/components/LoadingIndicator.tsx',
      // Tests stub react-native and assert on raw values.
      'src/__tests__/**',
    ],
    plugins: { smelter },
    rules: {
      'smelter/no-design-drift': 'error',
    },
  },
  {
    files: DRIFT_ALLOWLIST,
    rules: {
      'smelter/no-design-drift': 'warn',
    },
  },
]);
