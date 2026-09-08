# App performance validation

Worktree: `/private/tmp/smelter-performance`

Branch: `perf/ten-high-impact-improvements`

Base: `550f25092594de73cf8522f5f576f033ebfd9258`, the fetched `origin/main` when this work started. The main checkout was 47 commits behind and was left untouched.

## Scope

Ten targeted changes to reduce repeated requests, allocations, and React renders. Screen appearance, ordering rules, authorization, and persistence formats stay the same. No production dependencies, migrations, deployments, or remote database writes are part of this PR.

1. Cache cart normalization by immutable input and location.
2. Share concurrent inventory loads and retain forced follow-up refreshes.
3. Reuse the known session user ID during module bootstrap.
4. Batch and paginate stock-area item reads.
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

Integrated checks and remaining request/render measurements are pending.

## Test before merging

Use the Release simulator build from this worktree and sign in with an existing test account.

- Open inventory, browse, and cart. Add an item, change its quantity, move it between locations, and verify cart badges and totals update.
- Type name and alias searches. Confirm the same results and prefix ranking, then change location and search again.
- Open manager inventory in both list and compact views. Check row actions, bulk selection, reorder feedback, and search.
- In Quick Order, create enough local lines to scroll the order card. Check the scrollbar, edit/remove actions, and Dynamic Type.
- Open a stock location with several areas. Check every area's items and refresh after a count changes. Verify offline counts still restore.
- Change display settings, switch employee/manager views, and sign out and back in. Confirm styles update and no prior account's inventory or locations appear.

Do not send real supplier orders or change production stock solely for this test.

## References used during review

React Native documents the interaction between stable list callbacks and memoized rows in [Optimizing FlatList configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration). React documents the limits of prop comparison in [memo](https://react.dev/reference/react/memo).
