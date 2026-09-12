# Combined sign-in validation

The reported navigation bug was reproduced on iOS. Welcome opened name/PIN sign-in, but the Sign In link on signup opened a different email/password screen titled "Welcome Back". The same sequence now returns to the shared screen with Name and Email tabs, as selected by David.

Branch: `codex/auth-sign-in-routing`, based on `bf3c690` from `integration/app-store-2.3`. At task start this base was 5 commits ahead of and 20 behind the locally cached `origin/main`. No fetch, push, PR, merge, migration, or deployment was performed. The existing main-checkout iOS project change was left untouched.

## Changed files

- `src/features/auth/SignInScreen.tsx`: one form with explicit Name and Email methods, inline errors, email recovery, credential clearing on method switch, and synchronous duplicate-submit protection.
- `src/features/auth/NameSignInScreen.tsx`: removed the superseded standalone screen.
- `app/(auth)/sign-in.tsx`: renders the shared form.
- `app/(auth)/login.tsx`: redirects old email login URLs to the shared form with their parameters intact.
- `app/(auth)/signup.tsx`: returns to the shared form; email confirmation selects Email and preserves the address.
- `app/suspended.tsx`: signed-out visitors return to the shared form.
- `src/components/ui/Segment.tsx`: optional dark styling for the existing selector primitive.
- `src/__tests__/authRouteConsistency.test.ts`, `authScreensContract.test.ts`, `suspendedRouting.test.ts`: route and form regression coverage.
- This report and the three simulator screenshots in this directory.

## Audit

An independent subagent audited routes, credential compatibility, history, and the final diff. Invited name/PIN accounts use the existing name-login service. Legacy email accounts can lack a name identity and continue to use the existing email/password service. Explicit tabs avoid guessing because login names can contain an @ character. The shared form never falls back to the other authentication service after a failure.

Email authentication continues through the existing store action. Its underlying password-login contract was checked against [Supabase's documentation](https://supabase.com/docs/reference/javascript/auth-signinwithpassword). No backend implementation changed.

## Local checks

Run from `/private/tmp/smelter-auth-fix`:

| Command | Result |
| --- | --- |
| `npm run test:ci -- --runTestsByPath src/__tests__/authRouteConsistency.test.ts` before the fix | Failed both checks, reproducing the route split |
| `npm run test:ci -- --runTestsByPath src/__tests__/authRouteConsistency.test.ts src/__tests__/authScreensContract.test.ts` after the initial fix | Passed 10 tests |
| `npm run test:ci -- --runTestsByPath src/__tests__/authScreensContract.test.ts` after adding failure/recovery tests | Passed 10 tests |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm run test:ci` final | Passed 91 suites, 1,258 tests; one existing suite/test skipped |
| `git diff --check` | Passed |

An intermediate full run failed on the old suspended-screen route expectation. The expectation was updated to the canonical route, then the full suite passed. Existing React test-renderer deprecation output remains in Jest logs.

Ordering-specific verification scripts were not run because this change does not touch ordering.

## iOS reproduction and verification

Device: Smelter Auth Routing QA, iPhone 17 Pro Max, iOS 26.2, UDID `2974AFD2-03DD-47FF-9268-734A9A1D7614`.

The primary Smelter simulator was only inspected, not modified. The documented spare device was initially shutdown; it was booted, but `assert` detected Nellit and stopped further testing on it. A fresh device was created. `/private/tmp/smelter-auth-sim.sh` is a task-local copy of `scripts/sim.sh` with only its pinned UDID replaced; all device actions used that wrapper. No macOS mouse, keyboard, or screen control was used.

1. Installed the original Smelter simulator app on the fresh device.
2. Tapped Sign in, then Have a sign-up code instead, scrolled, and tapped Sign In.
3. Observed the separate "Welcome Back" email page. Saved `before.png`.
4. Exported the current worktree JavaScript and assets into a copy of that native simulator app:

```sh
EXPO_ROUTER_APP_ROOT=/private/tmp/smelter-auth-fix/app npx expo export:embed --entry-file node_modules/expo-router/entry.js --platform ios --dev false --bundle-output /private/tmp/SmelterAuthQA.app/main.jsbundle --assets-dest /private/tmp/SmelterAuthQA.app --max-workers 2
```

5. Installed and launched that integrated app on the fresh device using the pinned wrapper:

```sh
/private/tmp/smelter-auth-sim.sh assert
/private/tmp/smelter-auth-sim.sh install /private/tmp/SmelterAuthQA.app
/private/tmp/smelter-auth-sim.sh launch com.babytuna.systems
```

6. Repeated the same signup round trip. It returned to the shared Name/Email screen. An automated assertion on the captured UI trees failed before and passed afterward.
7. Selected Email and observed email/password fields plus Forgot password. Saved `name.png` and `email.png`.
8. Opened the old URL and verified the shared form selected Email, preserved the test address, and displayed the confirmation notice:

```sh
/private/tmp/smelter-auth-sim.sh openurl 'babytunasystems://login?email=qa%40example.com&notice=confirm-email'
```

The UI was inspected with `input describe-ui`, driven with `input tap` and `input swipe`, and captured with `io screenshot`. The AXe path was `/Users/david/.npm/_npx/99336612077b7094/node_modules/xcodebuildmcp/bundled/axe` via `SMELTER_AXE_PATH`.

## Limits and what to test

The native binary was reused; the worktree's complete JavaScript bundle and assets were rebuilt and run on iOS. No native source changed. Successful production account login was not tested because no authorized account credentials were supplied. Auth-service dispatch, errors, duplicate submission, and password recovery were checked with mocked services in Jest. No production password reset email was sent.

On the isolated simulator, repeat Sign in -> Have a sign-up code instead -> Sign In. Both tabs should be visible on the returning page. Use Name for an invited name/PIN account or Email for an existing email/password account.

No background test runner or Metro server remains running. The changes are local to the worktree and have not been installed into the user's original simulator or released.
