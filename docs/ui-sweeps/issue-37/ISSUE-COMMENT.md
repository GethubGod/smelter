# Comment for issue #37

Intended as the status comment on GethubGod/smelter#37. GitHub was unreachable
from this machine during the run (git push and gh both failed with connection
reset, and the gh keyring token is also invalid), so it is filed here to be
posted by hand.

Branch: `issue/37-merge-duplicate-routes`, based on
`integration/app-store-2.3` at 55c01dc. Not pushed.

## Done

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
  the last 20 native `Modal` hosts onto a new
  `src/components/ui/FullScreenSheet.tsx` primitive (the full-screen host #35
  said was missing).
- Removed the allowlist mechanism: `DRIFT_ALLOWLIST` and its config block,
  `eslint.drift.config.js`, and the `lint:drift` script.
  `smelter/no-design-drift` now runs as a plain part of `npm run lint` at error
  severity with no exceptions.

## Remaining

- Push the branch and open the PR. Both are blocked on network, not on work.
- `src/theme/design.ts` and the `src/constants/theme.ts` shim are still there:
  73 files under `app` and `src` import them, including
  `src/components/BottomSheetShell.tsx`. That migration wants its own issue.
- `cart`, `index`, `orders` and `profile` share a file name across the two
  groups but are not duplicates. `cart` was already merged; the other three are
  different screens with different data sources and chrome. Merging them would
  change behaviour, so they were left alone. Detail is in the PR body.

## What to test

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
  move, add and bulk add; quick-order item edit and quantity sheets; browse add
  item; quick search create; example editor; conversation history. Each should
  open, scroll, accept keyboard input and dismiss exactly as before.

## Checks

```
npm run typecheck                                                    pass
npm run lint                                                         pass, zero warnings
npx jest --runInBand --watchman=false --testPathIgnorePatterns '/node_modules/'
                                                                     85 suites passed, 1 skipped; 1232 tests passed
grep -rn "DRIFT_ALLOWLIST\|lint:drift" eslint.config.js package.json  no matches
```

No simulator run in this task, by design. The final verifier drives every
route.
