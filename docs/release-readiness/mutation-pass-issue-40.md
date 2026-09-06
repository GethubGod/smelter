# Mutation pass with database assertions (issue #40)

Every mutation named in issue #40 was driven on a real simulator against a real
local backend, screenshotted, and then asserted with psql. Eight pass. Two fail.

## Build and environment

| Item | Value |
| --- | --- |
| Commit tested | `8f7a0a5` (origin/main) |
| Build | `xcodebuild -workspace ios/Babytuna.xcworkspace -scheme Babytuna -configuration Release -sdk iphonesimulator -destination id=EF05F833-2AC4-4383-8688-36C51B956BCF -derivedDataPath /tmp/smelter-issue40-derived CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=YES build` |
| Simulator | `EF05F833-2AC4-4383-8688-36C51B956BCF`, driven headlessly by UDID through `scripts/sim.sh` |
| Backend | `FULL_STACK_PORT_BASE=54520 scripts/local-db/full-stack.sh up`, API `http://127.0.0.1:54521`, database `54522` |
| Fixtures | `scripts/release-readiness/setup-local-issue-40.sh` |
| App config | `.env` with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521` and the local publishable key. `scripts/prepare-ios-simulator-qa.py` disabled OTA checks on the simulator artifact only |
| Accessibility capture | AXe 1.8.0 at `/opt/homebrew/bin/axe`, via `SMELTER_AXE_PATH` |

All writes were disposable and went only to the loopback database (decision 3,
2026-09-05). Nothing touched production.

## Method

1. Drive the mutation through the app, never by hand in SQL.
2. Capture `xcrun simctl io <UDID> screenshot` and `axe describe-ui` at each step
   (`scripts/release-readiness/capture-issue-40.sh`).
3. Run the psql assertion and append the exact SQL and exact output to
   `e2e/issue-40/psql-assertions.md`
   (`scripts/release-readiness/assert-issue-40.sh`).
4. Record the mutation, its screenshots, its assertion section and its honest
   result in `report-content.json`
   (`scripts/release-readiness/record-issue-40.py`).

## Result

| Mutation | Result | Assertion section |
| --- | --- | --- |
| Quick Order send | Pass | `02-quick-order-send` |
| Stock count save | Fail | `12-stock-count-save` |
| Stock count offline sync | Fail | `13-stock-count-offline-sync` |
| Receive delivery | Pass | `04-receive-delivery` |
| Fulfillment Send All | Pass | `03-fulfillment-send-all` |
| Invite create | Pass | `08-invite-create` |
| Invite accept | Pass | `11-invite-accept` |
| Credential change then login | Pass | `09-credential-change`, `10-login-after-credential-change` |
| Account deletion | Pass | `14-account-deletion-before`, `15-account-deletion-after` |
| Order status changes | Pass | `05-order-status-changes` |
| Reminder scheduling | Pass | `06-reminder-send`, `07-reminder-scheduling` |

### The two failures

Stock count save and stock count offline sync write nothing to Postgres. The
screen reports the count, it survives a force quit, and it never leaves the
device. `stock_updates` and `stock_check_sessions` stay at zero rows,
`area_items.current_quantity` and `storage_areas.last_checked_at` are untouched,
and stopping the local API gateway during a count produced no error, no offline
indicator and no queue to flush when it came back. Filed as issue #69.

### Issue #60 did not reproduce

`Send All (1 supplier)` opened onto the resolved supplier card with its message
and finished the send. `past_orders`, `past_order_items` and the `pending` to
`sent` transition on `order_items` all landed. The empty state reported in #60
was not seen on this run, on the same commit and the same simulator. #60 was
updated rather than duplicated.

## Notes for whoever picks this up next

- `axe describe-ui` does not report React Native bottom sheets or iOS system
  alerts. Several steps here (the Quick Order Set Stock sheet, Confirm Location,
  the Sign Out and Delete account alerts) are invisible to it and had to be
  driven from screenshot coordinates. If a tap looks like it did nothing, take a
  screenshot before concluding the app is broken. This cost most of the debugging
  time in this pass.
- Screenshots are 1320x2868 pixels while `describe-ui` frames are 440x956
  points. Divide screenshot pixel coordinates by 3 before tapping.
- Metro caches `EXPO_PUBLIC_*` across builds. The first Release build here
  produced a bundle with no backend URL at all because `.env` was missing;
  writing `.env` was not enough, `$TMPDIR/metro-cache` had to be removed and the
  bundle rebuilt. Always confirm with
  `strings -a main.jsbundle | grep 127.0.0.1` before trusting a build.
- The simulator keychain outlives an app uninstall. A stale session from the
  previous pass produced `User from sub claim in JWT does not exist` against a
  freshly seeded database. `scripts/sim.sh keychain reset` cleared it.
- Issue #63 is still open: a fresh stack needs the `service_role` grants applied
  by hand or every edge function 500s. `setup-local-issue-40.sh` applies them.
- The Advanced ordering screen dropped into its error boundary once
  (`e2e/issue-40/09-quick-order-error-boundary.png`) after a message was sent
  while the cart held an item with an unresolved unit. `Try again` recovered the
  screen with the cart intact. It was seen once and not reproduced.
- `index.html` was deliberately not regenerated. `scripts/build-release-report.py`
  reads `route-inventory.json`, and this branch predates PR #64's route
  inventory, so regenerating here would drop that work. The builder also has no
  section for the new `mutations` key yet.
