# Studio 2.4 build report

Implementation in progress on `feat/ui-studio-2.4` in `.claude/worktrees/ui-studio-2.4`.
Base: `integration/app-store-2.3`, commit `b4ff479`. `git fetch origin main integration/app-store-2.3` confirmed the integration branch is not fully merged into `origin/main`. The worktree was 9 ahead and 24 behind after its first three checkpoints. No push, PR, deployment, or remote migration has been performed.

## Validation

Initial token and list changes:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: initial run failed because native test doubles lacked Animated. After updating the shared double, exit 0, 90 suites passed, 1 skipped; 1250 tests passed, 1 skipped.

Stage A complete, commit `ca0fb37`:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 91 suites passed, 1 skipped; 1259 tests passed, 1 skipped, 1260 total. Initial integration runs exposed missing native test mocks and two lint warnings; these were corrected before the green run.

Stage B complete:

- `npx jest src/__tests__/simpleOrderRecentOrders.test.ts --runInBand`: exit 1 before tests because sandbox access to Watchman's state directory failed.
- `npm run test:ci -- src/__tests__/simpleOrderRecentOrders.test.ts`: exit 0, 1 suite and 14 tests passed. This command uses the repository's Watchman-free CI configuration.
- `npx eslint src/features/simpleOrder/recentOrders.ts src/features/simpleOrder/HistoryScreen.tsx src/features/simpleOrder/components/OrderDetailSheet.tsx src/components/ui/GlidePage.tsx src/components/ui/StudioToast.tsx src/lib/switchViewMode.ts`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 93 suites passed, 1 skipped; 1276 tests passed, 1 skipped, 1277 total. Earlier runs caught a native gesture option type error and root-layout test doubles missing the new notification hosts; corrected before the green run.
- Simulator acceptance items 1 to 14 remain pending. No acceptance captures have been claimed.

Stage C complete:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 96 suites passed, 1 skipped; 1291 tests passed, 1 skipped, 1292 total.
- `git diff --check`: exit 0.
- Worktree dependencies were cloned locally to isolate Expo quoting patches. `pod install --no-repo-update` initially failed in the sandbox on Hermes DNS, then succeeded with network access. Repeated after dependency isolation, it succeeded with 109 dependencies and 110 pods. Pod versions did not change; EXConstants and EXUpdates checksums reflect the required quoting patches.

## Deviations

- The browser URL policy blocked opening the local `reference-glide.html`. Reference inspection uses its HTML, CSS, and interaction code. Interactive browser comparison has not been performed. No alternate browser or URL workaround was attempted.

- Privacy choices remains the existing functional sheet. The existing pushed support route has unrelated content, so it was not substituted for a privacy screen.
- Pending checklist orders have no archived supplier message. Their detail sheet shows the existing unavailable-message text when expanded; no supplier message is fabricated.

- The selected checklist location changes the visible group, but the existing submission service assigns the order to the user's manager-set default location. The UI work does not change this authenticated service contract.
- Employee History now reads the user's checklist submissions immediately and their own direct-send archives. Manager-created supplier archives are not exposed to employees by existing RLS. Pending submission detail cannot display a supplier message that has not been archived for that employee.
- Profile uses a 280ms horizontal transition with the contract easing, left shadow and 28pt/110pt edge-swipe rules. The tab navigator does not provide the reference's behind-screen parallax/dimming. Actual native Stack routes use 280ms simple-push; native easing, shadow/parallax and release threshold cannot be customized through the current native-stack API.
- Direct-send review retains its existing supplier-specific subtitle and Continue to send action. Voice, Quantity and legacy Recent Orders retain their domain controls inside shared Sheet chrome. Existing reminders retain Remove reminder.

- Supplier review retains the unit pill and overflow menu for existing conversion, supplier reassignment, order-later, note, removal and breakdown actions. Multiple real notes appear on separate accent lines. Secondary logistics forms retain their existing controls.
- Inventory uses the reference list and search layout. Existing edit and bulk actions remain available through row press and long press. A usual quantity tag appears only when the checklist service supplies a real recommendation.

## Reference discrepancies

- Dense stepper gap is 2 in the reference, while the general written row anatomy says 4.
- Reference clears checks when sending succeeds, before Done rebuilds the list; written section 2.1 assigns clearing to Done.

## Remaining work

Complete stage D, run each stage's full checks, build and walk the simulator acceptance checklist, review the integrated diff, and record final commands and risks here.
