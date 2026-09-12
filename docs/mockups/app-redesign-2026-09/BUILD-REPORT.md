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

Stage B in progress:

- `npx jest src/__tests__/simpleOrderRecentOrders.test.ts --runInBand`: exit 1 before tests because sandbox access to Watchman's state directory failed.
- `npm run test:ci -- src/__tests__/simpleOrderRecentOrders.test.ts`: exit 0, 1 suite and 14 tests passed. This command uses the repository's Watchman-free CI configuration.
- `npx eslint src/features/simpleOrder/recentOrders.ts src/features/simpleOrder/HistoryScreen.tsx src/features/simpleOrder/components/OrderDetailSheet.tsx src/components/ui/GlidePage.tsx src/components/ui/StudioToast.tsx src/lib/switchViewMode.ts`: exit 0.
- Stage B integration checks remain pending.
- Simulator acceptance items 1 to 14 remain pending. No acceptance captures have been claimed.

## Deviations

- The browser URL policy blocked opening the local `reference-glide.html`. Reference inspection uses its HTML, CSS, and interaction code. Interactive browser comparison has not been performed. No alternate browser or URL workaround was attempted.

- Privacy choices remains the existing functional sheet. The existing pushed support route has unrelated content, so it was not substituted for a privacy screen.
- Pending checklist orders have no archived supplier message. Their detail sheet shows the existing unavailable-message text when expanded; no supplier message is fabricated.

## Reference discrepancies

- Dense stepper gap is 2 in the reference, while the general written row anatomy says 4.
- Reference clears checks when sending succeeds, before Done rebuilds the list; written section 2.1 assigns clearing to Done.

## Remaining work

Complete stages B through D, run each stage's full checks, build and walk the simulator acceptance checklist, review the integrated diff, and record final commands and risks here.
