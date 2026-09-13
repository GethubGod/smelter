# Auth flow C build report

Date: 2026-09-13

## Status

Auth flow C is implemented on `feat/auth-flow-c` in
`.claude/worktrees/auth-flow-c`. The branch was created from the requested
`integration/app-store-2.3` head at `b4ff479`. It was not rebased onto
`origin/main`; preflight recorded separate ancestry counts of 6 commits ahead
and 24 behind `origin/main` at that point.

The selected local base did not contain `feat/ui-studio-2.4`, so Gate A built
the required 2.4 Sheet values in this branch. The feature merged into the
remote integration branch at `c7a95da` while this work was already running.
No late rebase or merge was attempted during final validation.

The TypeScript, lint, Jest, web, Deno, migration, SQL fixture, CocoaPods,
and real local Supabase HTTP checks are complete. The integrated iOS build,
simulator walkthrough, and 16 acceptance screenshots are not complete because
both authorized Smelter simulators were unavailable for this task. The primary
QA simulator was in active use by another worker. The fallback simulator was
rejected by `scripts/sim.sh assert` after it found a Nellit installation.

No production migration, function deployment, app deployment, push, or PR was
performed.

## Implemented

- Rebuilt Welcome, the sign-in sheet, the three-step invite wizard, and Ready
  with the approved Studio auth tokens and Glide timings.
- Added native Apple sign-in through `expo-apple-authentication` and Supabase
  `signInWithIdToken`, while keeping Google on the existing OAuth path.
- Added provider-session deferral so invite membership is claimed before
  profile repair or team navigation. Canonical nullable profile roles now keep
  unaffiliated provider accounts out of team routes and queue drains.
- Added password, provider, cancellation, one-request, stale-result, and Ready
  navigation guards. The clipboard is read only from the Paste action.
- Added optional invited email support to native and web manager invite forms.
- Added an atomic invite membership claim for role, name, modules, location,
  and token consumption. Same-user link retries are idempotent. Existing-team,
  used, expired, weak-password, and unauthenticated paths preserve state.
- Preserved invite-owned names across later identity repair and excluded
  canonical role-null accounts from manager team results.
- Removed the in-app account creation, name login, PIN, access-code, and secure
  credential routes and their client services.
- Added a tracked SQL fixture and a real GoTrue/PostgREST/Edge Runtime HTTP
  verifier for repeatable local backend validation.

## Gate history

Gate A ran separately before its commit:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:ci`: exit 0, 90 suites passed and 1 skipped; 1,250 tests passed
  and 1 skipped.

B, C, and D were integrated in parallel after Gate A. Their writes overlapped
before a standalone B gate was recorded, so they are reported honestly as one
combined green gate:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:ci`: exit 0, 89 suites passed and 1 skipped; 1,235 tests passed
  and 1 skipped.
- An independent coordinator rerun produced the same result. The retained log
  is `/private/tmp/auth-flow-c-root-jest.log`.
- After the final auth sheet chrome change, an independent coordinator reran
  `npm run typecheck`, `npm run lint`, and `npm run test:ci`: all exited 0;
  Jest reported 89 suites passed and 1 skipped, with 1,236 tests passed and 1
  skipped. The retained log is
  `/private/tmp/auth-flow-c-root-jest-final.log`.
- `npm run test:ci -- src/__tests__/authScreensContract.test.ts src/__tests__/authStore.authFlow.test.ts src/__tests__/authStoreQueueDrainWiring.test.ts src/__tests__/inviteJoin.test.ts src/__tests__/inviteWizardScreens.test.ts src/__tests__/invitesAccept.test.ts src/__tests__/onboardingStore.test.ts src/__tests__/useAuthGuard.test.ts --silent`:
  exit 0, 8 suites and 57 tests passed.

Expected Jest console output remains from React Test Renderer deprecation
messages and existing parser fallback tests that deliberately run without a
Gemini key.

## Web validation

The worktree did not initially contain `web/node_modules`, so the first web
commands could not find Next, ESLint's Next config, or Vitest. `npm ci` in
`web/` installed the lockfile dependencies without changing the lockfile.

- `cd web && npm run typecheck`: exit 0.
- `cd web && npm run lint`: exit 0.
- `cd web && npm test`: exit 0, 25 files passed and 1 skipped; 280 tests passed
  and 8 skipped.
- An independent coordinator rerun produced the same result. Its retained log
  is `/private/tmp/auth-flow-c-root-web-tests.log`.

Vitest printed its existing warning about the future Vite native config
loader and CommonJS loading of `vitest.config.ts`.

## Backend validation

- `deno test --no-config supabase/functions/accept-invite/input.test.ts supabase/functions/create-invite/input.test.ts supabase/functions/list-users/user-role.test.ts supabase/functions/_shared/invites.test.ts`:
  exit 0, 22 passed and 0 failed.
- `deno check --no-config supabase/functions/accept-invite/index.ts`: exit 0.
- `deno check --no-config supabase/functions/create-invite/index.ts`: exit 0.
- `deno check --no-config supabase/functions/list-users/index.ts`: exit 0.
- `scripts/local-db/verify-migrations.sh`: the first sandboxed run exited 1
  because Docker socket access was denied. The approved local rerun exited 0
  with all 31 migrations applied cleanly to the production-schema baseline.
- `scripts/local-db/verify-migrations.sh --keep`, followed by
  `docker exec -i verify-migrations-66704-7877 psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/local-db/auth_invite_c_fixture.sql`:
  exit 0 with `PASS: auth invite backend fixture assertions all held`. The
  disposable verifier container was removed after the run.
- `FULL_STACK_PORT_BASE=54720 scripts/local-db/full-stack.sh up`: isolated
  local stack healthy on API 54721, database 54722, and Inbucket 54724.
- `FULL_STACK_PORT_BASE=54720 scripts/local-db/verify-auth-invite-c-http.sh`:
  exit 0 in an independent coordinator rerun. It passed manager auth, invited
  email and inviter preview, expired-token non-consumption, email acceptance and
  real GoTrue sign-in, name and module claims, role-null team-list exclusion,
  token-only link acceptance, same-user idempotency, different-user rejection,
  existing-team non-consumption, and weak-password rejection without creating
  an auth user.

The HTTP verifier uses real GoTrue sign-up/sign-in sessions and the local Edge
Runtime. It does not use a stubbed bearer token.

## Native preparation

- `cd ios && pod install`: exit 0 after network access was enabled. CocoaPods
  installed 110 dependencies and 111 pods, including
  `ExpoAppleAuthentication (8.0.8)`. The path-with-spaces resource-phase
  warnings remained, so the native build still needs to validate generated
  resource phases.
- Preflight `scripts/sim.sh assert` passed on the primary QA simulator, but it
  was already owned by another worker and was not touched further. The same
  assertion rejected the fallback simulator after finding Nellit installed.
  A build-target assertion immediately before Expo, the Expo iOS build, Metro,
  UI walkthrough, AXe pass, and screenshot capture remain unrun.
- No files were created under `build-captures/`. There are zero acceptance
  screenshots. This report does not substitute code inspection for the
  required native walkthrough.

## Acceptance checklist state

| Item | Current evidence | Simulator status |
| --- | --- | --- |
| 1. Signed-out Welcome | Component and contract tests green | Not run |
| 2. Sign-in sheet anatomy and opening motion | Component tests and token audit green | Not run |
| 3. Focus detent, wrong-password error, and clear-on-type | Behavioral tests green | Not run |
| 4. Correct password through Ready and home | Guard and screen tests green | Not run |
| 5. Google, Apple, and quiet cancellation | Store and screen tests green | Provider sheets and round trips not run |
| 6. Reset-password toasts | Sign-in sheet tests green | Not run |
| 7. Drag, scrim, and X dismissal | Sheet tests green | Not run |
| 8. Invite step 1 and pushed motion | Wizard tests green | Not run |
| 9. Paste, preview, progress, and expired error | Wizard and real backend checks green | Not run |
| 10. Step 2 summary, Wrong link, and X reset | Wizard tests green | Not run |
| 11. Provider invite claim and fade to Ready | Client and real link-claim checks green | Provider round trip and fade not run |
| 12. Email invite, password rules, and Keychain metadata | Wizard and real email-accept checks green | Keychain prompt not run |
| 13. Messages join-link entry | Join-route tests green | Not run from Messages |
| 14. Signup, Terms, and Privacy browser handoff | Browser options covered in code | Not run |
| 15. Settings sign-out returns to Welcome | Guard and sign-out tests green | Not run |
| 16. No legacy route or control | Required grep is empty | Native reachability not run |

Required removal check:

```sh
grep -rn "PinPad\|login-with-name\|acceptInviteOnboarding\|validate-access-code\|(auth)/signup\|(auth)/sign-in\|(auth)/login\|(auth)/secure" src app
```

Result: exit 1 with no matches, which is the expected empty result.

## Deviations

- Expo Router's supported native `slide_from_right` transition cannot express
  the reference's simultaneous underlying-screen translation to -24 percent
  and brightness 0.92. The build uses the native right push at 280 ms, keeps
  the sheet at 320 ms with a 240 ms scrim, and uses a 240 ms Ready fade. The
  exact underlying translation and brightness effect are not implemented.
- The rendered reference handles Terms and Privacy as prototype toasts. The
  explicit build scope requires a real `WebBrowser.openBrowserAsync` handoff,
  which is implemented with `done` and the accent control color.
- The rendered reference rejects bare invite tokens. The explicit contract
  requires bare tokens and the two exact production hosts, so the parser
  accepts valid bare tokens and HTTPS links for `tips.babytunasystems.com` and
  `smelterpos.com`.
- The rendered reference keeps the focused sheet at 88 percent after keyboard
  dismissal. The written contract requires it to return to the compact detent,
  which is implemented.
- The rendered reference makes a supplied invite email editable, disables
  password autofill, and gates Finish only on password rules. The explicit
  contract locks the bound email, enables `new-password` autofill, and also
  requires a valid email before Finish. Those written behaviors are
  implemented.
- Google and Apple production provider configuration was not assessed because
  no authorized simulator was available. Apple and OAuth integration passes
  TypeScript and mocked behavior checks, but no native compilation, provider
  UI, or callback round trip was completed.

## Deployment order and release risk

After review and merge, deploy in this order:

1. `20260913213012_auth_invite_link_claim.sql` migration.
2. `create-invite` Edge Function.
3. `accept-invite` Edge Function.
4. `list-users` Edge Function.
5. Web manager invite UI, if released separately.
6. iOS app build.

The migration drops the old onboarding credential RPC and the functions retire
the synthetic onboarding path. Older installed app versions that still call
those paths will no longer complete onboarding after the backend rollout. This
is the approved retirement, but backend and app release timing must be
coordinated. No deployment was performed from this worktree.
