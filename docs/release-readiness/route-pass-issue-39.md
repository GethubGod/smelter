# Runtime pass over the 18 never-exercised routes (issue #39)

Every route listed in issue #39 was driven on a real simulator against a real
local backend. Nothing in `route-inventory.json` is left at "Not exercised".

## Build and environment

| Item | Value |
| --- | --- |
| Commit tested | `8f7a0a5` (origin/main) |
| Build | `xcodebuild -workspace ios/Babytuna.xcworkspace -scheme Babytuna -configuration Release -sdk iphonesimulator -destination id=EF05F833-2AC4-4383-8688-36C51B956BCF -derivedDataPath /tmp/smelter-issue39-derived CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=YES build` |
| Simulator | `EF05F833-2AC4-4383-8688-36C51B956BCF` (Smelter Release QA iPhone 17 Pro Max, iOS 26.2), driven headlessly by UDID via `scripts/sim.sh` |
| Backend | `FULL_STACK_PORT_BASE=54520 scripts/local-db/full-stack.sh up`, API `http://127.0.0.1:54521`, database `54522` |
| App config | `.env` with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521` and the local publishable key. `scripts/prepare-ios-simulator-qa.py` disabled OTA checks on the simulator artifact only |
| Accessibility capture | AXe 1.8.0 (`brew install cameroncooke/axe/axe`), the tool `scripts/sim.sh input` already expects via `SMELTER_AXE_PATH` |

## Fixtures

`scripts/release-readiness/seed-local-mobile-e2e.sql` and
`scripts/release-readiness/seed-local-quick-order-catalog.sql` loaded against
three auth users created through the local GoTrue admin API. Known PINs were
written straight into `public.login_identities` (`E2E Manager` 1111,
`E2E Employee` 2222, `E2E Employee Two` 3333). Two invite rows were inserted so
the invited onboarding flow could be walked twice, once ending in a password and
once in a PIN. All writes were disposable and went only to the loopback
database (decision 3, 2026-09-05).

## Method per route

1. Put the app in the right session (invited onboarding, employee, or manager).
2. Deep link the route with `xcrun simctl openurl <UDID> babytunasystems://...`
   through `scripts/sim.sh openurl`. Group-qualified paths such as
   `babytunasystems:///(tabs)/profile` are required where `(tabs)` and
   `(manager)` both define the same file name.
3. Capture `xcrun simctl io <UDID> screenshot` and `axe describe-ui --udid <UDID>`.
4. Where the route needs real data, produce it through the app rather than by
   hand: the manager Quick Order flow created the `orders` rows that
   Fulfillment, the confirmation screen and the history detail screen then read.

Evidence lives in `docs/release-readiness/e2e/issue-39/`, one `.png` and one
`-ui.json` per capture. Names match the `evidence` entries in
`route-inventory.json`.

## Result

| Status | Routes |
| --- | --- |
| Pass | `(auth)/invite-hello`, `(auth)/ready`, `(auth)/secure`, `(auth)/secure-password`, `(auth)/secure-pin`, `(manager)/fulfillment-confirmation`, `(manager)/fulfillment-history-detail`, `(manager)/quick-order`, `(manager)/voice`, `(tabs)/index`, `(tabs)/inventory-browse`, `(tabs)/profile`, `(tabs)/voice`, `inventory-browse` |
| Partial | `(tabs)/draft` (renders and gates correctly, but no content state can exist) |
| Fail | `(manager)/fulfillment-send-all` |
| Blocked | `(auth)/complete-profile`, `suspended` (both unreachable at runtime) |

Defects filed: #59 (complete-profile unreachable), #60 (Send All empty state),
#61 (draft orphaned), #62 (suspended unreachable), #63 (local stack misses
`service_role` grants, which blocks every edge function).

## Limits of this pass

- A screenshot proves the state shown, not every mutation, role or error case.
  Mutation coverage is issue #40's scope.
- `(manager)/fulfillment-send-all` was exercised only to its empty state,
  because the screen never listed the pending supplier.
- `(tabs)/draft` was exercised only in its empty state, because no code path
  writes to the draft store.
- iOS raises its own "Update Password?" and "Sign Out" dialogs during these
  flows. They sit in a separate window and do not appear in `describe-ui`
  output; they were dismissed by coordinate from the screenshot.
