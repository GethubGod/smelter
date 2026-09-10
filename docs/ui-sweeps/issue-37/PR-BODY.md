# UI: merge the duplicated route files and finish the drift burn-down

Closes #37

Merge after #80.

Two things land here: the duplicated route files collapse onto shared screens,
and the design-drift backlog goes to zero so the lint rule runs with no
exceptions at all.

## 1. The six duplicated route files

Three pairs, six files, one implementation each. Route paths, file names and
behaviour are unchanged, so `docs/release-readiness/route-inventory.json` still
describes the same 71 routes.

| Route pair | Shared screen |
|---|---|
| `app/(tabs)/quick-order.tsx` + `app/(manager)/quick-order.tsx` | `src/features/ordering/QuickOrderRouteScreen.tsx` |
| `app/(tabs)/voice.tsx` + `app/(manager)/voice.tsx` | `src/features/smart/SmartOrderRouteScreen.tsx` |
| `app/(tabs)/inventory-browse.tsx` + `app/(manager)/browse.tsx` | `src/features/browse/BrowseInventoryRouteScreen.tsx` |

Each shared screen follows the pattern the codebase already uses for
`HomeScreenView`, `CartScreenView` and `BrowseInventoryScreenView`: one
component plus an exported mode object per surface. Every route file is now
five to nine lines and does nothing but render the shared screen with its mode.
What used to be duplicated and now lives in exactly one place:

- Quick order: the `ordering_advanced` module guard, the redirect while it
  resolves, the error boundary and the chat screen. The modes carry the home
  route the guard redirects to, the boundary title, and the employee surface's
  own `ScreenHeader` (the manager surface has none, as before).
- Voice: the redirect that keeps both routes addressable while Smart Order is
  not exposed. `SMART_ORDER_ENABLED` moved into the shared file and stays
  `false`. The employee surface is pinned `exposed: false` independently of the
  flag, exactly as it was.
- Browse: the deep-link parameter plumbing (`category`, `focusSearch`,
  `focusItemId`, `expandItem`, `addItem`, `requestId`), which was character for
  character identical in the two route files.

`EmployeeBrowseInventoryScreen.tsx` and `ManagerBrowseInventoryScreen.tsx` were
duplicates of each other whose only job was to bind a mode to
`BrowseInventoryScreenView`. The route screen does that now, so both are
deleted.

### Route files that share a name but are not duplicates

`cart.tsx`, `index.tsx`, `orders.tsx` and `profile.tsx` also exist in both
groups. Only `cart` is a true pair, and it was already merged: both files
render `CartScreenView` with their ordering mode, so there is nothing left to
extract. The other three are different screens that happen to share a file
name, and merging them would change behaviour rather than preserve it:

- `index`: employee is a redirect to the first visible pill tab; manager is the
  manager home screen.
- `orders`: employee is the signed-in user's own order history from
  `useOrderStore` (`app/orders/history.tsx`, re-exported by the tab route);
  manager is an all-users queue that queries Supabase directly, with a location
  filter, per-status counts and a realtime subscription. Different data, chrome
  and lifecycle.
- `profile`: employee is the account screen (name, email, credential, delete
  account); manager is the manager settings list built from
  `buildSettingsGroups`.

Forcing those into one component would mean a single screen with two disjoint
halves selected by a mode flag, which is more code and more risk than the
duplication it removes. Flagging rather than doing it, since this PR promises
no behaviour change.

## 2. Design drift: 79 to 0, and the allowlist mechanism is gone

The rule reported 79 violations across 12 files on this base. All 79 are fixed
with tokens and primitives:

- 51 numeric font sizes, all through `ds.fontSize(n)` except two plain literals
  in `app/_layout.tsx`, now `typeScale` (`BrowseInventoryScreenView`,
  `BrowseItemRow`, `SupplierContactsScreen`, `SmartOrderScreen`, `_layout`).
  Mapping follows the earlier sweeps: 11 to `caption`, 12 and 13 to
  `secondary`, 14 to 16 to `body`, 17 to 22 to `title`.
- 6 `rgba()` colours: the browse sheet scrim to `color.scrim`, the stepper
  tiles to `color.well` with `color.hairlineStrong` borders, the destructive
  icon button border to `color.alertBg`.
- 2 numeric sheet radii to `radius.sheet`.
- 12 native `Modal` hosts (12 JSX hosts across 8 files, one `FullScreenSheet`
  import per file). This was the gap #35 documented and could not close:
  `Sheet` and `BottomSheetShell` are a fixed-height bottom sheet with no
  internal scroll container, so the full-screen forms and the keyboard-aware
  sheets had nowhere to go. Added `src/components/ui/FullScreenSheet.tsx`, the
  second designated `Modal` host, with `presentation="page"` for the opaque iOS
  card (five manager inventory forms, the quick-order review edit modal, the
  quick-search create modal, the example editor, the conversation history) and
  `presentation="overlay"` for the three sheets that draw their own scrim and
  `KeyboardAvoidingView` (quick-order edit, quick-order quantity, browse add
  item). Callers keep their bodies unchanged; only the host moved.

With the count at zero: `DRIFT_ALLOWLIST` and its config block are deleted from
`eslint.config.js`, `eslint.drift.config.js` is deleted, and the `lint:drift`
script is deleted from `package.json`. `smelter/no-design-drift` now runs as a
plain part of `npm run lint` at error severity with no exceptions.

Verified that the rule really fires under `npm run lint` and is not silently
disabled: a temporary probe file containing `"#ff0000"` and `fontSize: 17`
produced two `smelter/no-design-drift` errors, and was then deleted.

## 3. design.ts was not deleted

`src/theme/design.ts` and the `src/constants/theme.ts` shim stay. 73 files
under `app` and `src` still import them, so the condition for deleting them is
not met. Grouped:

| Folder | Files |
|---|---|
| src/features/ordering | 16 |
| src/components | 16 |
| src/features/fulfillment/components | 11 |
| src/features/ordering/quickOrderConfig | 5 |
| src/components/ui | 4 |
| src/__tests__ | 4 |
| app/(manager) | 4 |
| src/components/navigation | 3 |
| src/features/browse | 2 |
| one each | src/theme, src/features/smart, src/features/settings, src/features/home, src/features/home/components, src/features/fulfillment/sendAll, src/constants, app |

`src/components/BottomSheetShell.tsx`, the primary modal host, is one of them,
so the migration is a real piece of work rather than a tidy-up at the end of
this PR.

## Commands and results

```
npm run typecheck                                                    pass
npm run lint                                                         pass, zero warnings, drift rule active with no allowlist
npx jest --runInBand --watchman=false --testPathIgnorePatterns '/node_modules/'
                                                                     85 suites passed, 1 skipped; 1232 tests passed, 1 skipped
grep -rn "DRIFT_ALLOWLIST\|lint:drift" eslint.config.js package.json  no matches
```

Drift count before and after, from the report script on the base commit and
from `npm run lint` after: 79 violations across 12 files, then 0.

No simulator run in this task. The final verifier drives every route.

## Assumptions

1. "The six route files duplicated between (tabs) and (manager)" means six
   files, that is three pairs. Those are the three pairs whose bodies were
   genuinely duplicated. `cart` was already merged, and `index`, `orders` and
   `profile` are different screens sharing a name, as set out above.
2. Adding `FullScreenSheet` to `src/components/ui` is in scope for "fix every
   one with tokens and primitives". Without a full-screen host the last 20
   violations cannot be fixed without rebuilding twelve forms, and #35 already
   recorded the missing primitive as the reason those files stayed on the
   allowlist.
3. The font-size mapping above matches what sweeps #33 to #36 did, so the same
   number maps to the same token across the app. It moves a few sizes by one or
   two points, which is the point of the contract.
4. `docs/release-readiness/route-inventory.json` is unchanged: no entry's notes
   mention duplication, and no route path moved. Separately, its
   `app/(auth)/complete-profile.tsx` entry points at a file that does not exist
   at the base commit either, so that is pre-existing and left alone.
5. No copy was touched, per the split with #38.

## Sol review

Findings from the Sol (gpt-5.6-sol, xhigh) review of 307936a, and what changed
for each. No P1s.

P2

- `BrowseInventoryScreenView.tsx`, `BrowseItemRow.tsx` and `app/_layout.tsx`
  used the wrong semantic token in three places: six uppercase section labels
  were `typeScale.secondary` instead of `typeScale.caption`, the sentence-form
  helper under the remaining-amount input was `typeScale.caption` instead of
  `typeScale.secondary`, and the root configuration-error title was
  `typeScale.title` (the pushed-title token) instead of `typeScale.display`
  (the root-title token). Fixed all three. Also checked the other two files
  touched by the same font-size sweep, `SupplierContactsScreen.tsx` and
  `SmartOrderScreen.tsx`, for the same class of mismatch: their uppercase
  section labels already use `caption` and their sentence-form helper text
  already uses `secondary`, so no further changes were needed there.
- Route redirects and the twelve native modal surfaces cannot be verified by
  typecheck, lint or jest. Native verification is left to the #49 verifier's
  route pass on the Release build, as before.

P3

- `FullScreenSheet.tsx`: the `onClose` doc comment promised iOS swipe-down
  dismissal that the component does not implement. Reworded to describe only
  what actually happens; no behaviour changed.
- `eslint-rules/no-design-drift.js`: the `Modal` diagnostic told every caller
  to use `Sheet`, even though `FullScreenSheet` now exists. The message now
  points callers to `Sheet` for a fixed-height sheet and `FullScreenSheet` for
  a scrolling full-screen or keyboard-aware form.
- `docs/ui-sweeps/issue-37/PR-BODY.md` miscounted the modal host change as 20;
  corrected to twelve JSX hosts across eight files (one `FullScreenSheet`
  import per file). The "what to test" checklist also omitted the Edit and
  Approve modal in `QuickOrderReviewQueueScreen.tsx:697`; added it.
- `docs/ui-sweeps/issue-37/ISSUE-COMMENT.md` was a transient, committed file
  that would go stale once the PR opens. Removed it and moved its (corrected)
  text into the "Issue comment draft" section below.

Not independently re-verified in this pass, per the review: the browse modal
scrim colour change (`color.scrim`, 30% black) is a visible change left to
native review.

## Issue comment draft

## Comment for issue #37

Intended as the status comment on GethubGod/smelter#37. GitHub was unreachable
from this machine during the run (git push and gh both failed with connection
reset, and the gh keyring token is also invalid), so it is filed here to be
posted by hand.

Branch: `issue/37-merge-duplicate-routes`, based on
`integration/app-store-2.3` at 55c01dc. Not pushed.

### Done

- Three route pairs, six files, merged onto one shared screen each:
  `quick-order` to `src/features/ordering/QuickOrderRouteScreen.tsx`, `voice`
  to `src/features/smart/SmartOrderRouteScreen.tsx`, and
  `(tabs)/inventory-browse` plus `(manager)/browse` to
  `src/features/browse/BrowseInventoryRouteScreen.tsx`. Every route file is now
  a thin wrapper that renders the shared screen with its mode. Route paths and
  behaviour unchanged.
- Deleted `EmployeeBrowseInventoryScreen.tsx` and
  `ManagerBrowseInventoryScreen.tsx`, duplicates of each other that the route
  screen replaces.
- Design drift 79 to 0 across the 12 remaining files: numeric font sizes to
  `typeScale`, `rgba()` to colour tokens, sheet radii to `radius.sheet`, and
  the last 12 native `Modal` hosts (12 JSX hosts across 8 files) onto a new
  `src/components/ui/FullScreenSheet.tsx` primitive (the full-screen host #35
  said was missing).
- Removed the allowlist mechanism: `DRIFT_ALLOWLIST` and its config block,
  `eslint.drift.config.js`, and the `lint:drift` script.
  `smelter/no-design-drift` now runs as a plain part of `npm run lint` at error
  severity with no exceptions.

### Remaining

- Push the branch and open the PR. Both are blocked on network, not on work.
- `src/theme/design.ts` and the `src/constants/theme.ts` shim are still there:
  73 files under `app` and `src` import them, including
  `src/components/BottomSheetShell.tsx`. That migration wants its own issue.
- `cart`, `index`, `orders` and `profile` share a file name across the two
  groups but are not duplicates. `cart` was already merged; the other three are
  different screens with different data sources and chrome. Merging them would
  change behaviour, so they were left alone. Detail is in the PR body.

### What to test

- Employee advanced ordering at `/(tabs)/quick-order`: header reads "Advanced
  ordering", the chat screen loads, and turning `ordering_advanced` off
  redirects to the employee home.
- Manager quick order at `/(manager)/quick-order`: no extra header, and with
  `ordering_advanced` off it redirects to `/(manager)`, not to `/(tabs)`.
- `/(tabs)/voice` redirects to the employee home and `/(manager)/voice`
  redirects to manager home. Smart Order stays hidden on both.
- Browse deep links still carry every parameter: open
  `/(tabs)/inventory-browse?category=fish&focusSearch=1` and the manager
  equivalent `/(manager)/browse?...`, plus the root
  `/inventory-browse?category=fish` redirect, and check the category filter,
  search focus, item focus, auto expand and add on arrival all still fire.
- The modals that moved onto the new host: manager inventory edit, move, bulk
  move, add and bulk add; quick-order item edit and quantity sheets; the Edit
  and Approve modal in `QuickOrderReviewQueueScreen.tsx`; browse add item;
  quick search create; example editor; conversation history. Each should open,
  scroll, accept keyboard input and dismiss exactly as before.

### Checks

```
npm run typecheck                                                    pass
npm run lint                                                         pass, zero warnings
npx jest --runInBand --watchman=false --testPathIgnorePatterns '/node_modules/'
                                                                     85 suites passed, 1 skipped; 1232 tests passed
grep -rn "DRIFT_ALLOWLIST\|lint:drift" eslint.config.js package.json  no matches
```

No simulator run in this task, by design. The final verifier drives every
route.
