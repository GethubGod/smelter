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
- 20 native `Modal` hosts. This was the gap #35 documented and could not close:
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
