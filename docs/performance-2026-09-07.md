# App performance validation

Worktree: `/private/tmp/smelter-performance`

Branch: `perf/ten-high-impact-improvements`

Base: `550f25092594de73cf8522f5f576f033ebfd9258`, the fetched `origin/main` when this work started. The main checkout was 47 commits behind and was left untouched.

## Scope

Ten targeted changes to reduce repeated requests, allocations, and React renders. Screen appearance, ordering rules, authorization, and persistence formats stay the same. No production dependencies, migrations, deployments, or remote database writes are part of this PR.

1. Cache cart normalization by immutable input and location.
2. Share concurrent inventory loads and retain forced follow-up refreshes.
3. Reuse the known session user ID during module bootstrap.
4. Skip serialization and storage writes when persisted inventory data has not changed.
5. Share concurrent location catalog loads.
6. Update the Quick Order scrollbar with Reanimated shared values.
7. Stabilize `useScaledStyles` and its subscriptions.
8. Memoize manager inventory rows with stable callbacks.
9. Narrow broad store subscriptions in navigation and frequently used screens.
10. Prepare catalog search text when the catalog changes.

## Baseline

Executed in the worktree before implementation:

| Command | Result |
| --- | --- |
| `npm ci --offline --ignore-scripts --no-audit --no-fund` | Passed, 1,121 packages installed. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed, zero warnings allowed. |
| `npm run test:ci` | Passed, 69 suites and 1,051 tests. One existing suite/test skipped. |
| `npm run verify:submit-order-rpc` | Passed after copying the existing ignored public app configuration and allowing network access. The unauthenticated probe resolved the eight-parameter RPC and received its expected authorization denial. This does not test submission. |
| `npm run audit:quick-order-recognition` | Blocked. No inventory rows are visible to the configured public key. Empty results do not count as a passing recognition audit. |

Initial live-check attempts without configuration failed. Sandboxed attempts with configuration failed to reach the network. The table records the later network-enabled outcomes.

Baseline Release build and launch passed on the repo's pinned Smelter QA simulator, `EF05F833-2AC4-4383-8688-36C51B956BCF`, iOS 26.2. Welcome and sign-in screens were inspected. No credentials were entered.

## Final measurements and checks

Measured with `node scripts/measure-performance-work.cjs`. The script loads the actual baseline helpers from Git and compares them with the worktree, including output equivalence checks.

| Synthetic workload | Baseline | Updated |
| --- | --- | --- |
| 1,000 catalog items, 20 full-scan searches | 20,000 name reads and 20,000 alias reads | 1,000 of each, including index construction |
| 200 cart lines, 100 reads without changing the cart | 100 arrays and 20,000 distinct item objects | One array and 200 distinct item objects |

Search ranking and result limits also match the baseline. These are counts of avoided work, not production frame-rate or latency measurements.

| Integrated command | Result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed, zero warnings allowed. |
| `npm run test:ci` | Passed: 74 suites, 1,082 tests. One existing suite/test skipped. |
| `node scripts/measure-performance-work.cjs` | Passed baseline equivalence and work-count assertions. |
| `git diff --check` | Passed. |
| `scripts/sim.sh assert` | Passed for the pinned Smelter QA device. |
| `scripts/sim.sh io screenshot /private/tmp/smelter-perf-final.png` | Passed; final app welcome screen visually inspected. |

The root-layout regression test was also run against actual baseline source. A location-catalog update produced two total navigation renders before the change and one afterward. The updated test verifies that sign-in still mounts subscriptions and sign-out cleans them up. Request tests cover coalescing, forced follow-up refreshes, and account transitions. Persistence tests cover failed writes, retries, hydration, and conflicting pending writes.

The integrated Release build passed with compiler/bundler warnings using XcodeBuildMCP, which ran:

```sh
/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -workspace /private/tmp/smelter-performance/ios/Babytuna.xcworkspace -scheme Babytuna -configuration Release -skipMacroValidation -destination "platform=iOS Simulator,id=EF05F833-2AC4-4383-8688-36C51B956BCF" -collect-test-diagnostics never -derivedDataPath /private/tmp/smelter-performance/ios/build build
```

Artifact: `/private/tmp/smelter-performance/ios/build/Build/Products/Release-iphonesimulator/Babytuna.app`.

The app was installed and launched through `scripts/sim.sh` on Smelter QA, then left running for testing. The final JavaScript bundle SHA-256 is `f7809114ece330d0155ea02bff786256a181c47dc5d24b68c25b2c8ce434b33d`. OTA updates were disabled only in this generated simulator artifact, which was ad hoc signed and verified, so a cached update cannot replace the branch under test. No tracked native configuration changed. No Metro or background test runner remains.

There was no signed-in simulator session. Authenticated inventory, ordering, and account-switch flows remain manual validation items; no device latency or frame-rate improvement is claimed. The live recognition audit remains blocked as described above. An additional independent relaunch was rejected by automatic approval review because it would interrupt the running app. Read-only screenshot, artifact hash, plist, and code-signature checks succeeded instead.

## Test before merging

Use the Release simulator build from this worktree and sign in with an existing test account.

- Open inventory, browse, and cart. Add an item, change its quantity, move it between locations, and verify cart badges and totals update.
- Type name and alias searches. Confirm the same results and prefix ranking, then change location and search again.
- Open manager inventory in both list and compact views. Check row actions, bulk selection, reorder feedback, and search.
- In Quick Order, create enough local lines to scroll the order card. Check the scrollbar, edit/remove actions, and Dynamic Type.
- Refresh inventory, go offline, and reopen it. Confirm cached inventory still restores and new inventory edits still persist.
- Change display settings, switch employee/manager views, and sign out and back in. Confirm styles update and no prior account's inventory or locations appear.

Do not send real supplier orders or change production stock solely for this test.

## References used during review

React Native documents the interaction between stable list callbacks and memoized rows in [Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration). React documents the limits of prop comparison in [memo](https://react.dev/reference/react/memo).

## PR #75 authenticated rerun (2026-09-09)

The PR body left the authenticated flows as manual checks because no signed-in
session existed during the original validation. This section records the rerun
that closed them.

- Build under test: commit `806c874`, Release configuration, build log `build-pr75.log`.
- Simulator: Smelter QA iPhone 17 Pro Max, UDID `EF05F833-2AC4-4383-8688-36C51B956BCF`, driven headlessly through `scripts/sim.sh`.
- Stack: local full stack at `FULL_STACK_PORT_BASE=54580`, API `http://127.0.0.1:54581`, database container `supabase_db_smelter-performance`.
- Accounts: `e2e.manager@smelter.test` (manager) and a disposable invitee created during the run. Offline windows were produced by stopping and starting `supabase_kong_smelter-performance`.
- Evidence: screenshots and `describe-ui` JSON under `docs/release-readiness/e2e/issue-40/` with the `pr75-` prefix; database assertions appended to `docs/release-readiness/e2e/issue-40/psql-assertions.md` under the matching `pr75-` slugs.

### Mutations

| Mutation | Result | Screenshots | Assertion slugs |
| --- | --- | --- | --- |
| Quick Order send | Pass | `pr75-80-quick-order-empty` … `pr75-86-quick-order-submitted` | `pr75-72-quick-order-send` |
| Stock count save | Pass | `pr75-150-stock-check-home`, `pr75-151-stock-check-list`, `pr75-152-stock-set-sheet`, `pr75-153-stock-count-saved` | `pr75-80-stock-count-baseline`, `pr75-81-stock-count-save` |
| Stock count offline sync | Pass | `pr75-154-stock-offline-sheet`, `pr75-155-stock-offline-counted`, `pr75-161-stock-after-reconnect` | `pr75-82-stock-count-offline-pending`, `pr75-83-stock-count-offline-sync` |
| Receive delivery | Pass | `pr75-40-receive-delivery-list` … `pr75-43-receive-delivery-saved` | `pr75-04-receive-delivery` |
| Fulfillment Send All | Pass | `pr75-90-fulfillment`, `pr75-91-send-all-supplier-card`, `pr75-92-send-all-after-copy` | `pr75-73-fulfillment-send-all` |
| Order status changes | Pass | `pr75-100-order-detail-manager`, `pr75-101-order-processing`, `pr75-102-order-fulfilled` | `pr75-75-order-status-changes` |
| Invite create | Pass | `pr75-170-invite-form`, `pr75-171-invite-link-ready` | `pr75-85-invite-create` |
| Invite accept | Pass | `pr75-191-invite-hello`, `pr75-192-invite-secure`, `pr75-193-invite-accepted` | `pr75-88-invite-accept`, `pr75-89-invite-accept-rows` |
| Credential change then login | Pass | `pr75-200-change-pin`, `pr75-201-signin-new-pin`, `pr75-202-signed-in-new-pin` | `pr75-90-credential-before`, `pr75-91-credential-change`, `pr75-92-login-after-credential-change`, `pr75-93-login-attempts` |
| Account deletion | Pass | `pr75-210-delete-account-confirm`, `pr75-211-delete-account-typed`, `pr75-212-account-deleted` | `pr75-94-account-deletion-before`, `pr75-95-account-deletion-after` |
| Reminder scheduling | Pass | `pr75-180-reminder-sent`, `pr75-181-recurring-rule-form`, `pr75-182-recurring-rule-saved` | `pr75-86-reminder-send-and-scheduling`, `pr75-87-reminder-send-rows` |

Details worth recording:

- Stock count save wrote a real row on this build. `stock_updates` moved from 0 to 1, `area_items.current_quantity` for Fixture Salmon changed with a fresh `updated_at`, and `storage_areas.last_checked_at` was set for Fixture Freezer. Issue #69, which recorded this mutation as a failure on the earlier pass, did not reproduce.
- Stock count offline sync also passed. Fixture Rice was counted with the gateway stopped, the database still showed the old value at that moment (`pr75-82`), and after the gateway was restarted and the app was force quit and relaunched, `stock_updates` reached 2 and Fixture Rice landed in the database (`pr75-83`).
- The Set Stock sheet uses a native picker. Synthetic swipe injection cannot move a native `UIPickerView`, so both counts were saved at the wheel's initial value rather than a typed number. The save path itself, which is what these two mutations verify, was exercised and confirmed in the database.
- Invite accept applied the module preset: the invitee's tab bar showed Order, History and Settings only, matching `ordering_advanced=false` in `user_modules`.
- Account deletion purged the profile, login identity, user modules and auth user, and left `invites.used_at` set with `used_by` cleared, so the invite cannot be reused.

### Manual checks from the PR body

| Check | Result | Evidence |
| --- | --- | --- |
| Cart edits | Pass | `pr75-140-cart-item-added`, `pr75-141-cart-qty-increased`, `pr75-142-cart-qty-decreased`, `pr75-147-cart-with-item`, `pr75-148-cart-qty-edited` |
| Location changes | Pass | `pr75-143-location-switcher-open`, `pr75-144-location-switched-poki`, `pr75-145-location-back-sushi-cart-kept`, `pr75-149-cart-after-location-change` |
| Name and alias search | Pass | `pr75-94-inventory-name-search`, `pr75-95-inventory-alias-search`, `pr75-131-checklist-name-search`, `pr75-132-checklist-alias-search` |
| Manager inventory list and compact views | Pass | `pr75-96-manager-inventory-list`, `pr75-97-manager-inventory-compact`, `pr75-98-manager-inventory-search` |
| Quick Order scrolling | Pass | `pr75-120-quick-order-scrollbar`, `pr75-121-quick-order-scrolled` |
| Cached inventory after offline, force quit and relaunch | Pass | `pr75-160-offline-relaunch-checklist`, `pr75-162-inventory-online`, `pr75-163-inventory-offline-cached`, assertion `pr75-84-cached-inventory-newest` |
| Display settings | Pass | `pr75-110-display-settings`, `pr75-111-display-settings-changed` |
| Sign out and sign in | Pass | `pr75-70-launch-welcome` … `pr75-78-manager-home`, plus `pr75-190-signed-out-for-invite`, `pr75-201-signin-new-pin`, `pr75-202-signed-in-new-pin` |

Details worth recording:

- Cart state is held per location. After switching to Fixture Poki & Pho and back to Fixture Sushi, `order-storage.cartByLocation` in the app container still held the Fixture Avocado line at quantity 3 in the Fixture Sushi bucket, which is the behaviour change 1 is meant to preserve.
- The Checklist screen's own item selection is ephemeral component state and is rebuilt when the checklist reloads for a new location, so an ad hoc added line does not survive a location switch. That lifecycle is unchanged by this PR: the only change to `SimpleOrderScreen.tsx` is swapping `filterCatalogItems` for the prebuilt search index.
- For the cached inventory check the app was taken offline, force quit and relaunched. `xcrun simctl get_app_container EF05F833-2AC4-4383-8688-36C51B956BCF com.babytuna.systems data` showed `inventory-storage` holding all six catalog items, including Fixture Tofu and Fixture Wasabi, the two most recently added rows. Assertion `pr75-84-cached-inventory-newest` shows the same six rows live in the database, so the persisted cache was the newest state. The offline Checklist showed an honest "Checklist unavailable / Network request failed" state rather than stale or invented data.

### Commands run for this rerun

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass, exit 0, no output. |
| `npm run lint` | Pass, exit 0, no output, `--max-warnings 0`. |
| `npm run test:ci` | Pass, exit 0. 74 suites passed and 1 skipped of 75; 1,090 tests passed and 1 skipped of 1,091. |
| `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54581 npm run verify:submit-order-rpc` | Pass, exit 0, against the local stack with the local `sb_publishable_` key. The 8 parameter contract resolved and the unauthenticated probe was rejected with HTTP 401 and Postgres code 42501. This still does not verify a successful submission. |
| `node scripts/measure-performance-work.cjs` | Pass, exit 0. Catalog name and alias reads 20,000 to 1,000 each; cart arrays 100 to 1 and item objects 20,000 to 200; result equivalence passed. |

No production code changed during this rerun. `ios/Babytuna.xcodeproj/project.pbxproj` is modified by the Release build and was reverted rather than committed.
