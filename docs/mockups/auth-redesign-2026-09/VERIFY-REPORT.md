# Auth flow C verification report

Date: 2026-09-13. Verifier: Claude (independent of the build). Branch
`feat/auth-flow-c` in `.claude/worktrees/auth-flow-c`, reviewed at `7da7dc0`
and fixed on top of it. The branch is 24 commits behind `origin/main`
(merge base `8b1d8a0`); it was not rebased.

Method: code read against SPEC.md and `reference-c.html`, checks re-run,
a real local Supabase stack on the 54720 port range, and a Debug build on the
Release QA simulator `EF05F833-2AC4-4383-8688-36C51B956BCF` driven headlessly
(AXe by UDID, `scripts/sim.sh io screenshot`). Every screenshot under
`verify-captures/` is mine; BUILD-REPORT.md claims were not trusted.
Layout numbers below come from the accessibility frames in points.

## Checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 (before and after fixes) |
| `npm run lint` | exit 0 (before and after fixes) |
| `npm run test:ci` | before fixes: exit 0, 89 suites passed, 1 skipped; 1237 tests passed, 1 skipped. After fixes: exit 0, 89 suites passed, 1 skipped; 1237 tests passed, 1 skipped |
| `FULL_STACK_PORT_BASE=54720 scripts/local-db/full-stack.sh up` | exit 0, GoTrue health 200 |
| `FULL_STACK_PORT_BASE=54720 scripts/local-db/verify-auth-invite-c-http.sh` | exit 1 twice: 24 PASS lines, then `manager list-users returned HTTP 000` (curl 20s timeout). A direct call to `list-users` returned HTTP 546 `WORKER_LIMIT` after 113s. The edge runtime logs show "CPU time soft limit reached" and "wall clock duration warning" while three local stacks were running on this Mac. Every accept-invite check before that point passed |
| `RCT_METRO_PORT=8091 npx expo run:ios --no-install --no-bundler --configuration Debug --device EF05F833-…` | Build Succeeded, 0 errors, 0 warnings, installed on the Release QA sim. Note: despite `--no-bundler` the command started Metro on 8081; I killed it and ran Metro on 8091 with `.env.local` pointing at the local stack |

## Backend, exercised with raw requests against the local stack

| Case | Request | Result |
| --- | --- | --- |
| Preview, fresh email-bound invite | `{token, validateOnly:true}` | 200 `valid:true`, invitedName, invitedEmail, invitedBy "Kevin Chen", role, locationGroup |
| Preview, expired | same | 200 `valid:false, reason:"expired", invitedBy:"Kevin Chen"` |
| Preview, used | same | 200 `valid:false, reason:"used"` |
| Credentials, expired token | `{token,email,password}` | 409 `expired`; no auth user created (`auth.users` count 0 for that email) |
| Credentials, used token | same | 409 `used`; no auth user created |
| Credentials, wrong email on an email-bound invite | same | 409 `email_mismatch`; no auth user created |
| Credentials, fresh invite (from the simulator, step 3) | same | 200; `used_at` set, profile `Maya Lin` / employee / provider email / profile_completed, 1 module enabled |
| Link, no bearer | `{token}` | 401 |
| Link, signed-in user who already has a role | `{token}` + bearer | 409 `already_on_team`; invite still unused |
| Link, expired token, signed-in | `{token}` + bearer | 409 `expired` (one earlier attempt got 401 while GoTrue was rate-limiting the token endpoint; a retry gave 409) |
| Link, invite already used by the same user | `{token}` + bearer | 200 idempotent (by design, same user and same role) |
| Synthetic members domain | `grep -rn members.babytunasystems supabase/functions` | empty. The only remaining mentions are the client display helper for existing legacy accounts (`src/services/selfProfile.ts:8`) and two comments |

## Acceptance checklist

| Item | Matches reference | Drift found (file:line, what differs, expected vs actual) | Fixed |
| --- | --- | --- | --- |
| 1 Cold start Welcome | Yes. Lockup 112×24 at y 76 (54+22), `Welcome` 22 above the cards, three 78-tall cards 10 apart, footer 30 from the bottom, no other text | `WelcomeScreen.tsx:59-63` card text-to-glyph gap 12 vs reference 14; subtitle 4 below the title vs 2; third card glyph was Ionicons `open-outline` (boxed arrow) vs the reference's bare up-right arrow | Yes, commit "Welcome cards" |
| 2 Sign-in sheet | Yes. 320ms slide, no bounce (code: `BottomSheetShell.tsx` 320/240 with `motion.ease`); Google, Apple, `or use email`, two wells, disabled `Sign in`, `Forgot password?` | `SignInSheet.tsx:261` Forgot password? sat 24 below the button (12 gap + 12 padding) vs 12. `Button.tsx:159` white button ring rgba(0,0,0,.10) vs reference .08 | Yes, two commits |
| 3 Focus, wrong password, clear on type | Partly. Focus ring draws; wrong password shows the alert ring and `That password doesn't match. Try again or reset it.`; one keystroke clears it (AX count 0) | 88% detent not exercised: this sim has the hardware keyboard attached so no software keyboard appeared; the in-sim `AutomaticMinimizationEnabled` toggle did not change that. Code path is `keyboardDidShow → expandSheet(true)` to `0.88 × window` | n/a |
| 4 Correct password → Ready → home | Yes. Ready shows `You're set, Verify`, `Your Sushi order list is ready.`, ring check at 54+80, button 30 from the bottom; `See today's list` lands on the Order tab (Checklist). iOS offered to save the password | none | |
| 5 Google / Apple from the sheet, cancel | Yes for what can run: Google opens the OS consent sheet, Cancel returns with no error and the button back at rest; Apple shows the "Sign in to your Apple Account" sheet (no account on the sim), Close returns with no error | Consent sheet says "Babytuna" (bundle display name), as Codex declared. Provider round trips not possible locally | n/a |
| 6 Forgot password? toasts | Yes. Empty email: `Enter your email first` toast (AX), ~120 from the bottom. With an email: GoTrue recorded `recovery_sent_at`; the `Reset link sent to …` toast was not caught on screen because the local reset call took longer than the toast window; copy verified at `SignInSheet.tsx:169` | none | |
| 7 Drag, scrim, X | Yes. X, scrim tap and a 180pt drag from the header each closed the sheet (AX heading count 0 after each) | none | |
| 8 Step 1 push, 33%, junk error | Yes. X at 54+4, progress 14 below, title 22 below, sub 6, label 16/6, hint 8, Continue 18; Continue disabled while empty; junk shows `That doesn't look like an invite link…` with no request (no accept-invite line in the edge log) | Push motion is the native `slide_from_right` at 280ms; the underlying layer does not park at -24% / brightness .92 (Codex-declared, Expo Router cannot express it) | n/a |
| 9 Paste, Continue, 67%, expired | Yes. Paste triggered the iOS paste-permission prompt (clipboard read only on the tap), filled the well, Continue spun, step 2 arrived with the fill animating to 67%. Expired token: `This invite has expired. Ask Kevin to send a new one.` verified via the preview response and `inviteLinkErrorMessage`; the local edge runtime took 10-20s per preview | none | |
| 10 Step 2 summary, Wrong link, X | Yes. Name, `Babytuna Sushi`, `Employee`, `Kevin C.`; card 4×16 with 42-tall rows; `Wrong link` pops to step 1 with the link kept; X returns to Welcome and `reset()` clears the store (`InviteHelloScreen.tsx:172-176`) | `InviteHelloScreen.tsx:302` sub read `as a employee` (spec says lower-case role after `as a`, reference shows `as a server`) | Yes, article fix |
| 11 Step 2 Google → link mode → Ready | Partly. Google opens the consent sheet from step 2 and Cancel returns quietly; Apple sheet closes quietly. Link-mode claim verified over HTTP (table above); the wizard fade is the `ready` route's 240ms fade (`_layout.tsx:36`) | Round trip not possible locally | n/a |
| 12 Step 3 rules, Finish, Ready | Yes. Email prefilled and locked (`maya.lin@example.test`, enabled=false); `12345` ticks only "Not a common password" and Finish stays disabled; `12345abc` ticks all three, Finish enables, spins, Ready shows `You're set, Maya`; DB row consumed. `new-password` autofill and `passwordRules` set at `InviteLoginScreen.tsx:185-187`; no Keychain prompt observed after Finish on this sim | none | |
| 13 Join link lands on step 2 | Yes via `xcrun simctl openurl … babytunasystems://join?token=…` (URL scheme, not a Messages tap): step 2 directly | `InviteHelloScreen.tsx:272` progress animated 33→67 on arrival; spec says already at 67% | Yes |
| 14 smelterpos.com hand-off | Yes. `I'm setting up a restaurant`, Terms and Privacy open SFSafariViewController full screen; Done returns to Welcome. smelterpos.com/signup returns 404 (external, as declared). On iOS 26 the Done control renders as a glass ✓ in ink, not an accent `Done` word, although `controlsColor: accent` is passed (`legal.ts:12`) | none in-app | |
| 15 Sign out → Welcome | Yes, twice (employee via Settings → Sign out → confirm) | none | |
| 16 No legacy routes | Yes. `grep -rn "PinPad\|login-with-name\|acceptInviteOnboarding\|validate-access-code" src app` is empty; `babytunasystems:///signup`, `sign-in`, `login`, `secure`, `secure-pin` each render Expo's Unmatched Route | none | |
| 17 Checks green, no drift suppressions | Yes; `grep -rn "no-design-drift" src app` only finds the rule name in the lint config, no suppressions | none | |

Token and style audit (`src/theme/tokens.ts` auth block vs spec §1 and §2):
bg, text, dim, faint, well, wellFocus, wellError, accent, disabled, hair all
match; radii control 14 / card 22 / sheet 30 / pill 999; well 50 tall, button 52,
close 30, spinner 20; progress 420ms, Ready ring 460ms pop, error line 280ms,
paste flash 500ms, toast 220ms/1.8s; sheet detent 0.88. No uppercase label or
`SectionLabel` in `src/features/auth`. Codex also retuned the shared
`color.page/well/hairline/scrim`, `radius.*`, `typeScale.display` and
`tracking.display` to the 2.4 Studio values because the branch base did not
carry `feat/ui-studio-2.4`; expect merge conflicts against the integration
branch there.

## Discrepancies filed against the spec, not fixed

- Spec §1 says weights 400/600/700 only, but lists `link, quiet` at 14/500 and
  §2 says input text 15/500; the reference uses 500 in both places. The
  tokens contract test pins the three weights, so both render at 400.
- The sheet grabber is the shared 2.4 primitive (36×5, `rgba(0,0,0,.2)`,
  19pt band) while the reference draws it in `--disabled` inside a 22pt band.
- Reference step 3 leaves the invited email editable and does not gate
  Finish on it; the written contract locks it and requires a valid email
  (Codex-declared, kept).

## Adversarial pass

- Link mode cannot consume an invite for a signed-in user with a role: the
  RPC checks `profiles.role in ('employee','manager')` before any write
  (`20260913213012_auth_invite_link_claim.sql:227`), the function passes
  `rejectExistingMembership: true` (`accept-invite/index.ts:452`), verified
  409 with the invite left unused. Client side the auth guard also redirects a
  signed-in member away from the wizard.
- Expired or used tokens fail before any account exists: credentials mode
  checks validity at `index.ts:473` before `createUser` at `:489`; verified
  no `auth.users` rows for the three rejected attempts. If the claim fails
  after creation, `removeUnclaimedUser` deletes the auth user, profile and
  legacy row (`:304-322`).
- Clipboard: the only read is `Clipboard.getStringAsync()` inside
  `handlePaste` (`InviteLinkScreen.tsx:94`); iOS showed its paste-permission
  prompt on the tap and nowhere else. No other auth file imports Clipboard.
- Logging: no `console.*` in `src/features/auth`, `services/invites.ts` or
  `inviteLinks.ts`. The function logs only reason/status on user-creation
  failure (`index.ts:502`) and the PostgREST error object on read/claim
  failures; none of the log lines include the token, email or password.
- Finding, medium: link mode ignores `invited_email`
  (`requireInvitedEmailMatch: false`, `index.ts:453`). Scenario: a manager
  emails an invite bound to maya@x; anyone who gets the link and taps Google
  with another account is claimed as Maya. Credentials mode enforces the
  match. The migration comment justifies it with Apple relay addresses;
  David should decide whether link mode should at least match when the
  provider email is a real address.
- Finding, low: signing in from the sheet with a Google/Apple account that
  has no role signs the user out and closes the sheet with no message
  (`SignInSheet.tsx:83-90`). Scenario: a person who has not been invited
  taps Continue with Google, completes it, and lands back on Welcome with no
  explanation.
- Finding, low: a non-network reset-password failure toasts
  `Enter your email first` (`SignInSheet.tsx:166`), which is misleading when
  the email was valid.
- Observation: the local `list-users` function hit the edge runtime worker
  limit on every attempt here, so the manager team list (and the
  `Needs a new invite` badge) is unverified in this pass.
- Observation: a sim carrying persisted state from a different branch logs
  `State loaded from storage couldn't be migrated since no migrate function
  was provided` (zustand persist) on launch. Pre-existing, not auth.

## Not verifiable on the simulator

- Google and Apple round trips: no provider credentials are configured on
  the local stack and the sim has no Apple account. Only the OS prompts and
  their cancellation paths were exercised.
- The 88% keyboard detent: the Release QA sim has a hardware keyboard
  attached, so no software keyboard appears headlessly.
- iCloud Keychain saving on Finish: the iOS Save Password prompt appeared
  after the sheet sign-in but not after Finish on this sim.
- A live Messages tap: the URL scheme was opened with `simctl openurl`.
- Millisecond motion timing: durations were read from code, not measured.
- `Reset link sent to …` on screen: GoTrue recorded the recovery, but the
  local request outlived the toast's 1.8s window every time.

## Deploy order (from BUILD-REPORT.md, unchanged)

1. `20260913213012_auth_invite_link_claim.sql`
2. `create-invite`
3. `accept-invite`
4. `list-users`
5. Web manager invite UI
6. iOS build

Nothing was deployed, pushed or opened as a PR from this pass.
