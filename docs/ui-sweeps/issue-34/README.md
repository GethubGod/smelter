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
