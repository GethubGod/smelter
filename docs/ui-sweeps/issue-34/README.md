# Issue #34: employee screens on the UI contract

Before and after for every employee screen this sweep touched.

- Before: the existing capture from `docs/release-readiness/e2e/` named in the
  table. Those were taken from the integration build before this branch.
- After: captured from this branch's Debug build on the second simulator,
  UDID `493660C2-D09B-4B39-AC50-705FFD205948`, signed in as
  `e2e.employee@smelter.test` against the shared local stack on port 54601.

| Screen | Route | Before | After |
| --- | --- | --- | --- |
| Checklist (Order tab) | `/(tabs)/simple-order` | `docs/release-readiness/e2e/27-employee-checklist.png` | `after/01-checklist.png` |
| Quantity card sheet | `/(tabs)/simple-order` | `docs/release-readiness/e2e/15-manager-add-note.png` | `after/02-quantity-sheet.png` |
| Advanced ordering | `/(tabs)/quick-order` | `docs/release-readiness/e2e/issue-40/05-quick-order.png` | `after/03-advanced-ordering.png` |
| Cart | `/(tabs)/cart` | `docs/release-readiness/e2e/root-manager-cart.png` | `after/04-cart.png` |
| Past orders (History tab) | `/(tabs)/history` | `docs/release-readiness/e2e/13-manager-history-empty.png` | `after/05-history.png` |
| My orders | `/orders/history` | `docs/release-readiness/e2e/root-order-history.png` | `after/06-my-orders.png` |
| Order detail | `/orders/[id]` | `docs/release-readiness/e2e/root-order-detail.png` | `after/07-order-detail.png` |
| Receive delivery | `/(tabs)/receive-delivery` | `docs/release-readiness/e2e/18-manager-receive-empty.png` | `after/08-receive-delivery.png` |
| Stock check home | `/(tabs)/stock-check` | `docs/release-readiness/e2e/root-stock-home.png` | `after/09-stock-home.png` |
| Stock check list | `/(tabs)/stock-check-list` | `docs/release-readiness/e2e/root-stock-list.png` | `after/10-stock-list.png` |
| Set stock sheet | `/(tabs)/stock-check-list` | `docs/release-readiness/e2e/issue-69/22-rerun-set-stock-6-case.png` | `after/11-set-stock-sheet.png` |
| Past checks | `/(tabs)/past-checks` | `docs/release-readiness/e2e/root-past-checks.png` | `after/12-past-checks.png` |
| Voice | `/(tabs)/voice` | `docs/release-readiness/e2e/issue-39/08-tabs-voice-redirect.png` | `after/13-voice.png` |

## Update 2026-09-10: Sol review fixes

Recaptured on the same second simulator (UDID
`493660C2-D09B-4B39-AC50-705FFD205948`, Metro on 8092), signed in as
`E2E Employee` against the shared local stack on port 54601. Only the screens
whose look changed were retaken; every other row above still points at the
capture from the first pass.

| Screen | Route | Before | After | What changed |
| --- | --- | --- | --- | --- |
| Quantity card sheet | `/(tabs)/simple-order` | `after/02-quantity-sheet.png` (first pass) | `after/02-quantity-sheet.png` | Unit control is now `Segment`; sheet clears the home indicator |
| Cart | `/(tabs)/cart` | `docs/release-readiness/e2e/root-manager-cart.png` | `after/04-cart.png` | `Card` instead of `GlassSurface`, pack/base control is now `Segment` |
| Cart, empty | `/(tabs)/cart` | `docs/release-readiness/e2e/root-manager-cart.png` | `after/20-cart-empty.png` | Reorder actions sit on `Card` |
| Past orders | `/(tabs)/history` | `docs/release-readiness/e2e/13-manager-history-empty.png` | `after/05-history.png` | Sheet safe-area fix (see the note below) |
| Stock check home | `/(tabs)/stock-check` | `docs/release-readiness/e2e/root-stock-home.png` | `after/09-stock-home.png` | Unchanged by the fixes, retaken for the set |
| Stock check list | `/(tabs)/stock-check-list` | `docs/release-readiness/e2e/root-stock-list.png` | `after/10-stock-list.png` | Unchanged by the fixes, retaken for the set |
| Stock swipe, mark full | `/(tabs)/stock-check-list` | none | `after/24-stock-swipe-full.png` | Reveal uses the action accent, not the `good` status colour |
| Stock swipe, mark all out | `/(tabs)/stock-check-list` | none | `after/25-stock-swipe-empty.png` | Reveal uses neutral ink, not the `alert` status colour |
| Order note sheet | `/(tabs)/simple-order` | none | `after/16-order-note-sheet.png` | Save is back inside the keyboard-avoiding region |
| Cart item note sheet | `/(tabs)/cart` | none | `after/21-cart-note-sheet.png` | Save is back inside the keyboard-avoiding region |
| Quick actions sheet | `/(tabs)/simple-order` | none | `after/15-quick-actions-sheet.png` | Migrated from `BottomSheetShell` to `Sheet` |
| Checklist display sheet | `/(tabs)/simple-order` | none | `after/17-checklist-display-sheet.png` | Migrated to `Sheet` |
| Recent orders sheet | `/(tabs)/simple-order` | none | `after/18-recent-orders-sheet.png` | Migrated to `Sheet` |
| Review order sheet | `/(tabs)/simple-order` | none | `after/19-confirm-order-sheet.png` | Migrated to `Sheet` |
| Order-day reminder sheet | `/settings` | none | `after/23-order-day-reminder-sheet.png` | Migrated to `Sheet` |
| Order submitted overlay | `/(tabs)/cart` | none | `after/22-submission-overlay.png` | `Card` instead of `GlassSurface`; timer bar is the accent, not `good` |
| Manager home | `/(manager)/home` | none | `after/14-manager-home.png` | Captured because the sweep touched the shared Home files |

Not captured, and why:

- History order detail sheet. The local employee has no sent orders, so the
  Past orders screen is the empty state and the detail sheet cannot open. The
  safe-area fix on that sheet is covered by
  `src/__tests__/employeeSweepContract.test.ts`.
- Station picker sheet. The fix there is `accessibilityState.selected` on the
  chosen row, which has no visual effect, and the local fixture location does
  not surface the picker. Covered by the same test file.
- Voice add sheet. `EXPO_PUBLIC_ENABLE_QUICK_ORDER_VOICE` is false on the local
  stack, so the sheet cannot be opened there. Its migration to `Sheet` is a
  straight shell swap.
