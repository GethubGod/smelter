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
