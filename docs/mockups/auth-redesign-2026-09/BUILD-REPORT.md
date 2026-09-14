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
real local Supabase HTTP checks, and an integrated iOS compiler build are
complete. Native evidence is recorded item-by-item below. A clean sign-in
Ready recapture is limited by the local GoTrue health timeout;
it is not replaced with code inspection or build success.

No production migration, function deployment, app deployment, push, or PR was
performed.

## Implemented

- Rebuilt Welcome, the sign-in sheet, the three-step invite wizard, and Ready
  with the approved Studio auth tokens and the supported Glide timing subset.
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

## Handoff map and local commits

Meaningful review areas:

- Auth UI and motion: `src/features/auth/`,
  `src/components/BottomSheetShell.tsx`, `src/components/ui/{Button,Sheet}.tsx`,
  `src/theme/tokens.ts`, and `app/(auth)/`.
- Native setup: `app.json`, `ios/Babytuna/Babytuna.entitlements`,
  `ios/Podfile.lock`, and `scripts/sim.sh`.
- Invite and session contracts: `src/store/authStore.ts`, `src/services/invites.ts`,
  `src/services/inviteLinks.ts`, `src/hooks/useAuthGuard.ts`, and
  `src/features/team/`.
- Backend and repeatable verification:
  `supabase/migrations/20260913213012_auth_invite_link_claim.sql`,
  `supabase/functions/{accept-invite,create-invite,list-users}/`, and
  `scripts/local-db/{auth_invite_c_fixture.sql,verify-auth-invite-c-http.sh}`.
- Web manager invite form: `web/src/components/dashboard/InviteCreateModal.tsx`
  and `web/src/lib/dashboard/invites.ts`.

Local commits on `feat/auth-flow-c`, oldest first:

```
6c9ea1f Allow authorized secondary Smelter simulator
221383c Build Studio auth primitives
5a3f058 Add atomic invite membership claims
a0ef663 Harden invite claim retries
1973248 Build invite authentication wizard
a16bcbb Allow idempotent invite link retries
f33cb43 Hide unaffiliated users from team lists
95ac608 Complete auth flow C integration
fe03a90 Enable native Apple sign in entitlement
ff56e84 Enforce invite password requirements
07b6a0b Match auth sheet chrome to reference
6b6cebd Add auth flow C HTTP validation harness
c28f84d Document auth flow C validation
fd986ce Provision dedicated auth flow C simulator
42fce88 Constrain Welcome lockup dimensions
8344502 Document native auth flow validation
```

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
- With the final lockup fix, latest coordinator reruns of `npm run typecheck`
  and `npm run lint`: exit 0.
- `npm run test:ci -- src/__tests__/inviteWizardScreens.test.ts --silent`:
  exit 0, 10 tests passed.
- With the final lockup fix, `npm run test:ci >
  /private/tmp/auth-flow-c-root-jest-native-final.log 2>&1`: exit 0, 89 suites
  passed and 1 skipped; 1,237 tests passed and 1 skipped.
- `npm run test:ci -- src/__tests__/authScreensContract.test.ts src/__tests__/authStore.authFlow.test.ts src/__tests__/authStoreQueueDrainWiring.test.ts src/__tests__/inviteJoin.test.ts src/__tests__/inviteWizardScreens.test.ts src/__tests__/invitesAccept.test.ts src/__tests__/onboardingStore.test.ts src/__tests__/useAuthGuard.test.ts --silent`:
  exit 0, 8 suites and 57 tests passed.

Expected Jest console output remains from React Test Renderer deprecation
messages and existing parser fallback tests that deliberately run without a
Gemini key.

## Final validation matrix

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 with the final lockup fix |
| `npm run lint` | exit 0 with the final lockup fix |
| `npm run test:ci > /private/tmp/auth-flow-c-root-jest-native-final.log 2>&1` | exit 0; 89 suites passed, 1 skipped; 1,237 tests passed, 1 skipped |
| `npm run test:ci -- src/__tests__/inviteWizardScreens.test.ts --silent` | exit 0; 10 tests passed |
| `cd web && npm run typecheck` | exit 0 |
| `cd web && npm run lint` | exit 0 |
| `cd web && npm test` | exit 0; 25 files passed, 1 skipped; 280 tests passed, 8 skipped |
| `deno test --no-config supabase/functions/accept-invite/input.test.ts supabase/functions/create-invite/input.test.ts supabase/functions/list-users/user-role.test.ts supabase/functions/_shared/invites.test.ts` | exit 0; 22 passed |
| `scripts/local-db/verify-migrations.sh` | approved rerun exit 0; 31 migrations applied cleanly |
| `FULL_STACK_PORT_BASE=54720 scripts/local-db/full-stack.sh up` | isolated local stack healthy on API 54721, database 54722, and Inbucket 54724 |
| `FULL_STACK_PORT_BASE=54720 scripts/local-db/verify-auth-invite-c-http.sh` | exit 0 against local GoTrue, PostgREST, and Edge Runtime |
| `cd ios && pod install` | exit 0; 110 dependencies and 111 pods installed |
| `RCT_METRO_PORT=8092 npx expo run:ios --no-install --no-bundler --configuration Debug --device 7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B` | reported `Build Succeeded`, 0 compiler errors, 0 compiler warnings; Metro kept the shell process running, so no exit code is claimed |

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
  `ExpoAppleAuthentication (8.0.8)`. CocoaPods emitted the known
  path-with-spaces resource-phase warnings; the later Expo build completed
  those generated phases.
- A fresh dedicated shutdown-only simulator, `Smelter Auth Flow C QA`
  (`7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B`, iPhone 17 Pro Max, iOS 26.2), was
  provisioned by `scripts/sim.sh` in commit `fd986ce`. The approved existing
  Smelter devices were preserved. The new UDID is a fixed `SMELTER_SIM_UDID`
  allowlist entry; arbitrary overrides, `booted`, and the Nellit UDID remain
  rejected.
- `RCT_METRO_PORT=8092 npx expo run:ios --no-install --no-bundler --configuration Debug --device 7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B`:
  reported `Build Succeeded` with 0 compiler errors and 0 compiler warnings.
  The process itself remained running because Metro started unexpectedly, so
  this report does not claim a shell exit code. The retained build log is
  `/private/tmp/smelter-auth-flow-c-expo-build-rct8092.log`. Port 8092 is a
  deliberate deviation from the usual 8091 to avoid another worker.
- The runtime diagnostics for deprecated `SafeAreaView` and existing require
  cycles remain. They are not compiler warnings and were not resolved by this
  auth build.
- The dedicated device's `RCT_jsLocation` preference was set to
  `127.0.0.1:8092`, resolving the simulator bundle issue. `expo-dev-client`
  is not installed, so deep-link retries were ineffective. Completed native
  evidence and its limits are listed item-by-item in the acceptance table;
  the clean sign-in Ready recapture is unavailable because local GoTrue health
  timed out after one isolated `supabase_auth_auth-flow-c` restart. The retry
  was stopped after the three-second health timeout persisted.
- The simulator bundle preference was repaired with
  `SMELTER_SIM_UDID=7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B scripts/sim.sh spawn defaults write com.babytuna.systems RCT_jsLocation '127.0.0.1:8092'`,
  followed by the same wrapper's terminate and launch commands. The derived
  lockup-height fix is commit `42fce88`.
- The keyboard-detent probe used the dedicated device only:
  `SMELTER_SIM_UDID=7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B scripts/sim.sh spawn defaults write com.apple.keyboard.preferences AutomaticMinimizationEnabled -bool false`,
  followed by an app-only relaunch.
- Native AX verified the lockup at `112 × 24` at `(164, 76)`. The clean
  `1320 × 2868` capture
  `build-captures/01-welcome.png` was accepted for the Welcome card/footer
  layout and lack of a toast. The clean `1320 × 2868`
  `build-captures/02-account-sheet.png` was accepted for static sheet anatomy:
  provider buttons, email and password wells, Show pill, disabled Sign in,
  and reset link. Additional reviewed native captures are named in the
  acceptance table.
- Independent capture-header audit found 27 valid PNG files, each
  `1320 × 2868`, with coverage for every item prefix 01 through 16. No pixels
  were modified during that audit.

## Cleanup

- Metro PID 2302 on port 8092 was stopped and the port was confirmed free.
- `FULL_STACK_PORT_BASE=54720 scripts/local-db/full-stack.sh down`: exit 0;
  the `auth-flow-c` project filter was removed and its configuration restored.
- Three temporary credential files were removed.
- The follow-up Docker inventory hung, was cancelled, and was not retried. No
  Docker-inventory verification is claimed.

## Acceptance checklist state

| Item | Current evidence | Simulator status |
| --- | --- | --- |
| 1. Signed-out Welcome | Component and contract tests green; native AX lockup `112 × 24` at `(164, 76)`; accepted `build-captures/01-welcome.png` | Pass |
| 2. Sign-in sheet anatomy and opening motion | Component tests and token audit green; accepted static `build-captures/02-account-sheet.png` verifies native sheet anatomy and entry layout | Behavior verified. Millisecond animation timing was not frame-measured; the supported timing subset and router motion deviation are documented below |
| 3. Focus detent, wrong-password error, and clear-on-type | Behavioral tests green; native observation verified the exact wrong-password copy and clearing on next type; root visually reviewed `03-wrong-password.png` and `03-keyboard-detent.png`, which shows focused email, a real software keyboard, sheet top at 12 percent for the 88 percent expanded detent, and all controls above the keyboard | Pass |
| 4. Correct password through Ready and home | Guard and screen tests green; native returning-user sign-in reached Ready, showed the iOS Save Password prompt in `04-ready.png`, retains that prompt in `04-keychain-prompt.png`, and reached the employee Checklist in `04-tabs-landing.png`. `12-invite-ready.png` is the separate clean invite-flow Ready capture | Functional Ready-to-home behavior verified. A clean returning-user Ready recapture is unavailable because the local GoTrue health check still timed out after one isolated restart |
| 5. Google, Apple, and quiet cancellation | Store and screen tests green; native provider UI opening verified in `05-provider-google.png` (OS consent for `127.0.0.1`) and `05-provider-apple.png` (Apple Account Settings required). Fresh Google cancellation and Apple close returned quietly to their originating provider controls without an error | Provider callback round trips were unavailable: local provider configuration/credentials were not established and the simulator has no Apple account |
| 6. Reset-password toasts | Sign-in sheet tests green; native empty-email toast `Enter your email first` verified in `06-forgot-empty.png`; local fixture verified `Reset link sent to …` in `06-forgot-password.png`; Luna confirmed both reset paths | Pass |
| 7. Drag, scrim, and X dismissal | Sheet tests green; Luna confirmed drag, scrim, and X dismissal, with `07-sheet-drag.png` and `07-scrim-close.png` | Pass |
| 8. Invite step 1 and pushed motion | Wizard tests green; clean native step 1 in `08-invite-step1.png` verifies entry layout | Behavior verified. Millisecond push-motion timing was not frame-measured; the supported timing subset and router motion deviation are documented below |
| 9. Paste, preview, progress, and expired error | Wizard and real backend checks green; local expired fixture verified exact manager-specific copy in `09-expired-invite.png`. Native flow copied a disposable token, used Paste to populate the field, fetched the local preview on Continue, and advanced from step 1 of 3 to step 2 of 3; AX verified invitee name, inviter, role, and location, with 2-of-3 progress shown in `10-invite-summary.png` | Behavior and progress state verified. Resulting transitions were observed, but millisecond timing was not frame-measured |
| 10. Step 2 summary, Wrong link, and X reset | Wizard tests green; valid step-two fixture UI in `10-invite-summary.png` shows restaurant, role, inviter, 2-of-3 progress, and links; Luna confirmed Wrong link returns to step 1; native wizard X reset returned fully to Welcome | Pass |
| 11. Provider invite claim and fade to Ready | Client and real link-claim checks green; native provider consent prompt in `11-invite-google.png`; Apple Account prompt from step 2 in `11-invite-apple.png` closed back to the same summary with provider controls and no error | Provider callback round trip, claim, and fade were unavailable: local provider configuration/credentials were not established and the simulator has no Apple account |
| 12. Email invite, password rules, and Keychain metadata | Native Finish passed after the local fixture correction; clean Ready state in `12-invite-ready.png`, then home. Native AX verified invited email is disabled, a weak 6-character password leaves Finish disabled, and a valid 24-character password enables Finish; clean step-three state in `12-invite-email-valid.png`. Database verification confirmed `used=true`, user creation with the invite-owned full name preserved, employee role, location assignment, and one enabled module | Pass for the invite flow. No invite-flow-specific Keychain prompt was observed; the iOS Save Password prompt recorded for item 4 remains sign-in-only evidence |
| 13. Messages join-link entry | Join-route tests green; root visually reviewed native URI-scheme join with a token opening valid step 2 in `13-join-deeplink.png` | Pass for scheme-route handling. This substitutes for a Messages tap because sending a live message was not authorized; live Messages receipt was not verified |
| 14. Signup, Terms, and Privacy browser handoff | Root visually reviewed native SFSafari handoff to configured `smelterpos.com` in `14-signup-browser.png`; Terms and Privacy content opened correctly in `14-terms-browser.png` and `14-privacy-browser.png` | The configured remote sign-up page returns 404. App handoff works, but the external page is a release blocker outside this app scope. External legal content still mentions legacy PIN/access-code credentials |
| 15. Settings sign-out returns to Welcome | Guard and sign-out tests green; Luna confirmed employee sign-out returns to Welcome in `15-sign-out-welcome.png` | Pass |
| 16. No legacy route or control | Required source grep is empty. Native retired `/signup`, `/sign-in`, `/login`, and `/secure` deep links each resolved to Expo's unmatched-route screen; AX found no forbidden legacy controls, with `/secure` shown in `16-no-legacy-routes.png` | Pass |

Required removal check:

```sh
grep -rn "PinPad\|login-with-name\|acceptInviteOnboarding\|validate-access-code\|(auth)/signup\|(auth)/sign-in\|(auth)/login\|(auth)/secure" src app
```

Result: exit 1 with no matches, which is the expected empty result.

## Deviations

- Expo Router's supported native `slide_from_right` transition cannot express
  the reference's simultaneous underlying-screen translation to -24 percent
  and brightness 0.92. The build implements the supported timing subset: the
  native right push at 280 ms, a sheet at 320 ms with a 240 ms scrim, and a
  240 ms Ready fade. The exact underlying translation and brightness effect
  are not implemented.
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
- The lockup keeps the delivered asset's intrinsic aspect ratio. Its native
  height is derived as `112 * 257 / 1198` rather than assigned an arbitrary
  fixed height; native AX confirms the resulting rendered size is `112 × 24`.
- Native Google consent surfaces identify the app as `Babytuna`, sourced from
  the existing iOS `CFBundleName` / `PRODUCT_NAME`, while in-app copy displays
  `Smelter`. This is existing native metadata outside the auth-flow scope, but
  is visible during provider consent and should be resolved before release.
- Google and Apple production provider configuration was not assessed. Apple
  and OAuth integration pass TypeScript, mocked behavior checks, and native
  compilation; provider UI opening is verified, but callback round trips
  remain unverified.
- Item 13 uses a URI-scheme join invocation as a safe substitute for tapping
  a live Messages-delivered link. It verifies the app's join-route handling,
  not delivery or receipt in Messages.
- The configured sign-up browser handoff opens correctly, but its remote
  `smelterpos.com` page currently returns 404. This external website issue is
  release-blocking until the destination is fixed.
- The externally hosted Terms and Privacy content still mentions retired
  PIN/access-code credentials. The app handoff is correct, but that content
  drift should be corrected before release.

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
