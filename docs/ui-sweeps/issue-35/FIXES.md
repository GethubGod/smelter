# Issue 35 manager operations sweep: review fixes

Branch `issue/35-manager-ops-fixes`, cut from the sweep head `18b14fc`. It
answers the Sol review of that commit. The screenshot worker holds the sweep
branch itself, so the fixes sit on this side branch.

## Not actioned, by instruction

Both P1s are out of scope for this pass, per the orchestrator note on the
review:

- **Manager folders exempt from drift enforcement.** Already resolved on
  `integration/app-store-2.3`, where PR #37 deleted the `DRIFT_ALLOWLIST`
  mechanism outright.
- **54 changed files still import `@/theme/design`.** A milestone-wide gap (73
  importers repo-wide after every sweep), deferred to a follow-up issue on the
  NEEDS-DAVID list.

The P3 about shared Home UI is also not reverted. `HomeScreenView` and
`HomeScreenPrimitives` were restyled by both the manager and the employee
sweep, and integration took this branch's version, so reverting would undo work
the employee sweep also depends on. Only the finding the review names in those
files (the `LoadingIndicator` call sites) is fixed here.

## Fixed

| Finding | Files | What changed |
| --- | --- | --- |
| P2 Accidental destructive dismissal | `src/components/BottomSheetShell.tsx`, `src/components/ui/Sheet.tsx`, `src/features/ordering/QuickOrderReviewQueueScreen.tsx`, `app/(manager)/employee-reminders-recurring.tsx` | `BottomSheetShell` takes an additive `dismissible` prop (default true) that turns off the scrim press and the drag gesture; `Sheet` forwards it. The rejection sheet locks while the note is non-empty, the rule editor locks while the form differs from what it opened with, and the rule editor gains a Cancel so it is never a trap. |
| P2 Five sheets bypass the Sheet primitive | `src/components/ConfirmLocationBottomSheet.tsx`, `src/components/ItemActionSheet.tsx`, `src/features/fulfillment/components/OrderLaterAddToSheet.tsx`, `src/features/fulfillment/components/OrderLaterScheduleModal.tsx`, `src/features/fulfillment/components/SupplierPickerBottomSheet.tsx` | All five now host `Sheet`: title from the primitive, one action in `primary`, alternatives as secondary `Button`s. |
| P2 Status colours outside StatusPill | `app/(manager)/orders.tsx` | Order cards render `StatusPill`; the status filters become neutral `Chip`s. |
| P2 Reorder is a green primary | `app/(manager)/fulfillment-history-detail.tsx` | Reorder is a secondary `Button`, so Share Again is the only primary on the screen. |
| P2 Loading states bypass Loading | `app/(manager)/fulfillment.tsx`, `app/(manager)/inventory.tsx`, `src/features/fulfillment/sendAll/SendAllScreen.tsx`, `src/features/home/HomeScreenView.tsx`, `src/features/home/components/HomeScreenPrimitives.tsx` | Every call site moves to `Loading` with a real accessibility label. |
| P2 Hand-built back buttons | `app/(manager)/orders.tsx`, `app/(manager)/fulfillment-history.tsx`, `app/(manager)/fulfillment-history-detail.tsx` (two states), `app/(manager)/employee-reminders-delivery.tsx` | All move onto `ScreenHeader mode="pushed"`. |
| P2 Undersized, colour-dependent inventory controls | `src/features/inventory/ManagerInventoryRow.tsx` | Stock state renders through `StatusPill` (dot plus word); both reorder controls reach 44pt through `hitSlop` and drop status colours for neutral plus accent. The memo wrapper, callbacks and keys are untouched. |
| P3 Dead modal styles | `src/components/QrScannerModal.tsx`, `src/features/ordering/QuickOrderReviewQueueScreen.tsx`, `src/features/ordering/QuickOrderScreen.tsx` | `overlay`, `container`, `header`, `title`, `rejectOverlay`, `missingReviewBackdrop` and `missingReviewCard` deleted. |

## Assumptions

1. **Non-dismissable while dirty, rather than keeping the draft.** Both sheets
   hold a draft that belongs to one order or one rule. Keeping it across a
   close would leak a stale rejection note into the next order a manager
   opened, so the sheet refuses the scrim and the drag instead and Cancel stays
   the way out.
2. **The `dismissible` prop is the smallest additive change to
   `src/components/ui/Sheet.tsx`.** It defaults to true, so every existing
   caller behaves exactly as before. It is compatible with the `bottomPadding`
   forwarding that PR #79 and #80 added on `issue/34-employee-sweep`: that
   change touches the safe-area import, the doc comment and the `insets` line,
   while this one adds a prop to the interface, the destructure and the
   `BottomSheetShell` call, so only the last of those overlaps and merges
   cleanly by keeping both props.
3. **`cancel_requested` reads as cancelled.** `StatusTone` has five states and
   `OrderStatus` has six; a cancel request shows the cancelled tone until it is
   resolved.
4. **Two extra `LoadingIndicator` sites in `app/(manager)/inventory.tsx`** (the
   Add Item and Add Items buttons) were fixed alongside the one the review
   names. Same class of issue, same owned file.
5. **`ItemActionSheet` loses its hand-built close circle.** The scrim and the
   handle are the contract close treatment, and the sheet still ends with a
   Cancel action.

## Checks

Run on the final commit of this branch, from the worktree.

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | pass |
| Lint | `npm run lint` (`--max-warnings 0`) | pass, zero warnings |
| Drift | `npm run lint:drift` | 18 violations in owned folders, unchanged from `18b14fc` |
| Tests | `npx jest --runInBand --watchman=false --testPathIgnorePatterns '/node_modules/'` | pass |

Drift detail: `lint:drift` reads `eslint.drift.config.js`, which has no
allowlist, so it reports the raw count. All 18 owned-folder violations are the
same documented primitive gap `18b14fc` recorded: full-screen `Modal` hosts
that the bottom-sheet `Sheet` primitive cannot replace. Six in
`app/(manager)/inventory.tsx`, two each in `QuickOrderItemEditModal`,
`QuickOrderQuantitySheet`, `QuickOrderReviewQueueScreen`,
`QuickSearchScreenView`, `quickOrderConfig/ExampleEditorModal` and
`src/components/tuna-specialist/ConversationHistory.tsx`. The count is
identical before and after this branch.

## Tests added

Both dismissal fixes are covered by tests that fail on `18b14fc` and pass here
(verified by stashing the source changes and re-running).

- `src/__tests__/sheetUnsavedInput.test.ts` renders the real `Sheet` and asserts
  the scrim press handler and the drag gesture are both live by default and
  both off when `dismissible` is false.
- `src/__tests__/unsavedSheetGuards.test.ts` renders the two screens and asserts
  the rejection sheet locks once a note is typed (and unlocks when the note is
  only whitespace), and that the rule editor locks after an edit and closes on
  Cancel.

## Known gap, not fixed here

`src/features/ordering/QuickOrderScreen.tsx` still carries 25 unused
`clarification*` and `suggestion*` style keys. They predate this sweep and are
unrelated to the Sheet migration the review flagged, so they are left for a
separate cleanup rather than widening this diff.
