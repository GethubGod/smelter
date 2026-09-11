# Issue #35 UI sweep — manager operations screens

Status: code is complete, reviewed, and fixed (see `FIXES.md` for the Sol
review pass on top of the original sweep). Checks are green: typecheck,
lint (zero warnings), drift (18 violations in owned folders, all one
documented primitive gap, unchanged from the original sweep commit), and
jest. After-screenshots were NOT captured — see "Why there are no after
shots" below.

Manager account for a retry: `e2e.manager@smelter.test` / `LocalQaManager1!`
(PIN `1111`), against the shared local stack at `http://127.0.0.1:54601`.
Primary simulator: `EF05F833-2AC4-4383-8688-36C51B956BCF` (iPhone 17 Pro Max).

## Screens and their before shots

Before images exist for every owned screen touched by this sweep (found in
`docs/release-readiness/e2e/`). After shots are not yet taken; the "After"
column names the file each retry should produce.

| Screen | Route | Before | After (to capture) |
| --- | --- | --- | --- |
| Manager home | `app/(manager)/index.tsx` | `docs/release-readiness/e2e/20-manager-home.png` | `after-home.png` |
| Fulfillment | `app/(manager)/fulfillment.tsx` | `docs/release-readiness/e2e/22-manager-fulfillment.png` | `after-fulfillment.png` |
| Fulfillment confirmation | `app/(manager)/fulfillment-confirmation.tsx` | `docs/release-readiness/e2e/issue-39/58-manager-fulfillment-confirmation.png` | `after-fulfillment-confirmation.png` |
| Orders | `app/(manager)/orders.tsx` | `docs/release-readiness/e2e/root-manager-orders.png` | `after-orders.png` |
| Inventory | `app/(manager)/inventory.tsx` | `docs/release-readiness/e2e/root-manager-inventory.png` | `after-inventory.png` |
| Browse | `app/(manager)/browse.tsx` | `docs/release-readiness/e2e/root-manager-browse.png` | `after-browse.png` |
| Quick order | `app/(manager)/quick-order.tsx` | `docs/release-readiness/e2e/21-manager-quick-order-filled.png` | `after-quick-order.png` |
| Export fish order | `app/(manager)/export-fish-order.tsx` | `docs/release-readiness/e2e/root-manager-export-fish-order.png` | `after-export-fish-order.png` |
| Fulfillment history | `app/(manager)/fulfillment-history.tsx` | `docs/release-readiness/e2e/root-manager-fulfillment-history.png` | `after-fulfillment-history.png` |
| Fulfillment history detail | `app/(manager)/fulfillment-history-detail.tsx` | `docs/release-readiness/e2e/issue-39/64-manager-fulfillment-history-detail.png` | `after-fulfillment-history-detail.png` |
| Profile | `app/(manager)/profile.tsx` | `docs/release-readiness/e2e/root-manager-profile.png` | `after-profile.png` |
| Employee reminders | `app/(manager)/employee-reminders.tsx` | `docs/release-readiness/e2e/root-manager-employee-reminders.png` | `after-employee-reminders.png` |
| Employee reminders — delivery | `app/(manager)/employee-reminders-delivery.tsx` | `docs/release-readiness/e2e/root-manager-employee-reminders-delivery.png` | `after-employee-reminders-delivery.png` |
| Employee reminders — recurring | `app/(manager)/employee-reminders-recurring.tsx` | `docs/release-readiness/e2e/root-manager-employee-reminders-recurring.png` | `after-employee-reminders-recurring.png` |
| Employee reminders — settings | `app/(manager)/employee-reminders-settings.tsx` | `docs/release-readiness/e2e/root-manager-employee-reminders-settings.png` | `after-employee-reminders-settings.png` |

Also worth a look on a retry, restyled but with no existing before capture on
record: `app/(manager)/fulfillment-send-all.tsx` (renders `SendAllScreen.tsx`).
Not captured: `app/(manager)/manager-settings/quick-order-config.tsx` — its
route is owned by manager-settings (excluded), even though the
`QuickOrderConfigScreen`/`quickOrderConfig/*` components it renders live
under `src/features/ordering` and were restyled here.

## Why there are no after shots

The primary simulator (`EF05F833-...`) turned out to be contended by more
than one concurrent worker this session:

1. Sign-in through the Debug/Metro build kept getting interrupted by full JS
   reloads roughly every 20-60 seconds ("Loading from Metro..."), which reset
   in-progress form state. A `watchman watch-del`/`watch-project` reset the
   repo's fsevents watch twice and helped briefly, but the reloads resumed.
2. To rule out Metro/watchman entirely, a Release-configuration build was
   made (embeds the JS bundle, no live reload). Installing it revealed a
   second problem: the simulator's Keychain still held a valid, but
   orphaned, Supabase session from a different account ("Fixture Sushi" /
   employee role, not `e2e.manager`) that survived an app uninstall+reinstall
   (Keychain items outlive app deletion on iOS). `xcrun simctl keychain
   <udid> reset` cleared it.
3. After that reset, sign-in reached a screen that does not match current
   `main`: a legacy email/password "Welcome Back" form
   (`app/(auth)/login.tsx`) instead of the current `NAME` / `PIN OR
   PASSWORD` screen (`app/(auth)/sign-in.tsx` → `NameSignInScreen.tsx`,
   confirmed as what `WelcomeScreen.tsx` actually routes "Sign in" to). The
   Release build's embedded bundle was stale relative to the worktree, so
   screenshots taken against it would not reflect this sweep's actual UI.
4. While chasing that down, `/tmp/smelter-sim-lock-EF05F833/NOTE` showed a
   concurrent "verifier (issue #49)" session reporting that this worker's
   Release build had installed over and replaced its own session on the same
   device around 15:24-15:27 PDT. The mkdir-based lock directory had not
   been released, but something raced on the owner file inside it, and two
   workers ended up driving the same device. On finding that note, this
   worker stopped all further device interaction, acknowledged the conflict
   in the NOTE file, and released the lock directory (`rm -rf
   /tmp/smelter-sim-lock-EF05F833`) so the other session could proceed.

Net effect: no reliable, current-code screenshot was captured before the
device had to be vacated. A retry should get a clean Debug build on a
free device/lock, sign in as the manager account above, and capture the
"After" files listed in the table.


## After captures (finisher, 2026-09-11)

Seven screens captured on the primary simulator from a Debug build of 32a0148 before the finisher was cut off; the remaining manager routes are covered by the #49 verifier's full route pass on the Release build of the integration head (docs/release-readiness/e2e/routes-2.3/), which includes this branch's code.

| Screen | After |
|---|---|
| fulfillment-send-all | after/after-fulfillment-send-all.png |
| fulfillment | after/after-fulfillment.png |
| home | after/after-home.png |
| inventory-list | after/after-inventory-list.png |
| quick-order-empty | after/after-quick-order-empty.png |
| quick-order-item-sheet | after/after-quick-order-item-sheet.png |
| quick-order-parsed | after/after-quick-order-parsed.png |
