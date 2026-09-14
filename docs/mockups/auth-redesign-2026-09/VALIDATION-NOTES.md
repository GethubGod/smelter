# Auth flow C validation notes

Date: 2026-09-13

## Preflight

- Branch: `feat/auth-flow-c`, HEAD `221383c` at the time of preparation.
- `origin/main`: `8b771a8f`. The branch is 6 commits ahead and 24 commits
  behind by separate ancestry counts.
- Xcode 26.2, Expo 54.0.27, CocoaPods 1.17.0, Docker, Supabase CLI, and
  AXe 1.8.0 are installed. AXe path: `/opt/homebrew/bin/axe`.
- `node_modules` was present before preparation. The primary simulator
  `EF05F833-2AC4-4383-8688-36C51B956BCF` was booted and passed
  `scripts/sim.sh assert`, but another worker had an active Babytuna process
  using it. No install, launch, build, or UI input was sent to that device.
- The approved fallback `493660C2-D09B-4B39-AC50-705FFD205948` was booted for
  a read-only availability check, then `scripts/sim.sh assert` rejected it
  because `com.worthunion.nailit` is installed. It is not used for this pass.
  The initial shutdown-state app inventory did not report that app; the
  post-boot assertion is authoritative.
- Existing local Supabase stacks occupy the 54521/54522/54524 and
  54621/54622/54624 ranges. Backend reserved `FULL_STACK_PORT_BASE=54720`.
- No Metro listener was present on 8091, 8092, or 8081 during preflight.

## CocoaPods

Command:

```sh
pod install
```

The sandboxed attempt stopped while resolving Hermes from Sonatype. The same
command completed with network access enabled: 110 dependencies and 111 total
pods installed, including `ExpoAppleAuthentication (8.0.8)`. It created the
ignored `ios/Pods` tree and `ios/Pods/Manifest.lock`. The tracked
`ios/Podfile.lock` gained the expected ExpoAppleAuthentication entries and was
left unstaged for the implementation owner.

CocoaPods printed path-with-spaces `find` warnings during generation but
exited successfully. The native build must still verify the generated Expo
resource phases from this checkout path.

Integrated build, local auth stack, auth walkthrough, and acceptance
screenshots remain pending the implementation lead's handoff.

## Local HTTP validation

The isolated full stack was started with:

```sh
FULL_STACK_PORT_BASE=54720 scripts/local-db/full-stack.sh up
```

The running project is `auth-flow-c`, with Kong/API on `54721`, Postgres on
`54722`, and Inbucket on `54724`. The auth, REST, edge-runtime, storage,
realtime, and metadata containers were healthy or running. The stack was left
up for the implementation and root validation passes.

The repeatable verifier is:

```sh
FULL_STACK_PORT_BASE=54720 scripts/local-db/verify-auth-invite-c-http.sh
```

It refreshes generated local credentials silently, uses disposable fixture
identities, and removes only its own auth users, invite rows, and location row
on exit. It refuses any port base other than `54720`, hard-codes loopback API
access, and does not print credentials.

The first run against the pre-idempotency handler passed preview
`invitedEmail`/`invitedBy`, email/password creation and real GoTrue sign-in,
invite-owned naming/location/module state, and authenticated link creation. It
found that repeating the same authenticated link returned `409 used`; commit
`a16bcbb` moved authenticated claims ahead of the generic used precheck.

The subsequent matrix passed missing and invalid bearer `401`, preview,
expired preview and acceptance without consumption, email/password acceptance
and GoTrue sign-in, invite-owned state and known module filtering, unresolved
provider exclusion from manager `list-users`, authenticated token-only link
acceptance, same-user retry `200`, different-user `409 used`, and
already-on-team `409 already_on_team` with the invite preserved.

An earlier run exposed a local harness/provider difference: public GoTrue
signup rejects a one-character password with `422 weak_password`, while the
service-role admin-create endpoint accepted it. This historical failure led to
the approved edge-function password policy check in `ff56e84`.

Root reran the unchanged verifier after `ff56e84` with:

```sh
FULL_STACK_PORT_BASE=54720 scripts/local-db/verify-auth-invite-c-http.sh
```

The rerun exited `0` with all 52 `PASS` lines, including weak-password
`422/password_rejected` with no account creation or invite consumption,
expired preview and acceptance, real GoTrue email/password sign-in, exact
token-only link acceptance, same-user idempotent retry, different-user
`409/used`, existing-team `409/already_on_team` with invite preservation,
preview `invitedEmail`/`invitedBy`, module filtering, unresolved-provider
exclusion from `list-users`, and missing/invalid-bearer `401` responses. The
stack remained running for the root's integrated pass after this rerun.

## Integrated iOS build and device

- The native dependency and entitlement configuration was stable before the
  build. No path-quoting source patch was needed. The generated Expo resource
  phases quote `$PODS_TARGET_SRCROOT`, the installed Expo scripts quote
  `$PROJECT_DIR`, and `Podfile.lock` matched `Pods/Manifest.lock`.
- A dedicated iPhone 17 Pro Max simulator named `Smelter Auth Flow C QA` was
  provisioned at UDID `7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B`. It is explicitly
  allowlisted by `scripts/sim.sh`; the primary Smelter device, the fallback
  containing Nellit, and Nellit's own device were not used.
- The integrated Debug compiler build completed with 0 errors and 0 warnings.
  Metro ran on the isolated port `8092`. Because this app does not install
  `expo-dev-client`, its runtime bundle location was set on the dedicated
  device only with:

  ```sh
  SMELTER_SIM_UDID=7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B scripts/sim.sh spawn defaults write com.babytuna.systems RCT_jsLocation '127.0.0.1:8092'
  ```

- The first native Welcome capture reproduced the missing lockup. AX reported
  the image at its intrinsic `1198 x 257` frame and positioned mostly off
  screen. Commit `42fce88` adds the height derived from the required 112-point
  width and the delivered asset ratio. Native AX then reported `112 x 24` at
  `(164, 76)`, and `build-captures/01-welcome.png` shows the fixed result.

## Native walkthrough

All simulator operations used the dedicated UDID through `scripts/sim.sh`.
The accepted evidence is under `build-captures/` and covers prefixes 01 through
16. Animation durations were not measured frame by frame; action completion
and the captured end states were verified.

- Welcome, sign-in sheet anatomy, wrong-password copy and clear-on-type,
  password-reset toasts, scrim/drag/X dismissal, invite steps 1 and 2, paste,
  preview, expired-invite handling, Wrong link, wizard X reset, Settings
  sign-out, and Ready-to-Checklist navigation were exercised natively.
- To display the software keyboard without changing global Simulator settings,
  the dedicated device only was configured with:

  ```sh
  SMELTER_SIM_UDID=7AF4F0F2-3D97-422A-88C0-8FDBF2B5934B scripts/sim.sh spawn defaults write com.apple.keyboard.preferences AutomaticMinimizationEnabled -bool false
  ```

  After an app-only relaunch, the software keyboard appeared and the sign-in
  sheet expanded on focus. The verified state is
  `build-captures/03-keyboard-detent.png`.
- Native Google consent opened for the returning-user sheet and invite step 2.
  Cancel returned to the sheet with no error. Native Apple sign-in opened from
  invite step 2; the unsigned simulator presented the Apple Account Settings
  prompt, and Close returned to step 2 with no error. Provider round trips were
  not performed because local provider configuration and credentials were not
  established, and the simulator has no configured Apple account.
- Email invite step 3 locked the invite-owned email. A weak six-character
  letter-and-number password kept Finish disabled. A generated 24-character
  password enabled the 52-point Finish button, and Finish reached Ready.
  The first attempt identified a local UI fixture mismatch: the invite claimed
  `sushi`, but its only location short code began with `UI-`, so the atomic RPC
  returned `location_missing`. The disposable location short code was corrected
  to begin with `S-`, matching the production location resolver. The retry
  succeeded. A bounded database check reported invite used, auth user present,
  invite-owned name, employee role in both profile tables, assigned location,
  and one enabled module.
- The native Keychain Save Password prompt appeared after returning-user
  sign-in and is preserved in `04-keychain-prompt.png`. That sign-in reached
  Ready and the employee Checklist route. A clean invite Ready state is in
  `12-invite-ready.png`. A later attempt to recapture the returning-user Ready
  state without the Keychain prompt ended when the isolated local GoTrue health
  endpoint stopped responding. One restart of only
  `supabase_auth_auth-flow-c` completed, but the bounded three-second health
  check still timed out, so no repeated recovery was attempted.
- `babytunasystems://join?token=<redacted>` opened a valid invite directly at
  step 2 with 67-percent progress. This validates the app route but substitutes
  for a live Messages-delivered link; no message was sent.
- Signup, Terms, and Privacy each opened the native SFSafari view and Done
  returned to Welcome. Terms and Privacy served valid content. The configured
  `https://smelterpos.com/signup` page returned 404. The hosted legal text also
  still mentions legacy PIN and access-code behavior; both are external content
  issues rather than app routes.
- Retired native deep-link paths `/signup`, `/sign-in`, `/login`, and `/secure`
  each resolved to Expo's `Unmatched Route`. AX found no name field, PIN pad,
  access-code control, or in-app Create Account form on those routes.

## Native environment findings

Sandboxed `simctl` and AX commands produced misleading CoreSimulatorService
`Connection invalid` and `simdiskimaged` errors because the process could not
open CoreSimulator logs. The identical commands succeeded with approved local
simulator access. No CoreSimulator service, runtime, or other device was
restarted.
