# Handoff: Auth version C (Welcome, sign-in sheet, invite wizard)

Two prompts. The first goes to Codex to build. The second goes to a Claude
agent afterwards to verify the build against the reference and fix drift.
Both point at the same two files in this folder:

- `reference-c.html` — the approved interactive reference (open it in a
  browser; every control on the phone works, including the website inside
  the in-app browser; also published at the artifact link David has).
- `SPEC.md` — the written contract with every number, copy string and
  behaviour, the backend changes in section 9, and the acceptance checklist
  in section 10.

`index.html` in the same folder is the earlier three-way comparison (A, B, C).
Ignore it for building.

Out of scope for both prompts: the smelterpos.com sign-up website. The app
opens `https://smelterpos.com/signup` in the in-app browser and nothing
more. The site is a separate deliverable.

---

## Open question for David (default applied unless he says otherwise)

Existing accounts created through the old name-plus-PIN onboarding live
under synthetic `join-{id}@members.babytunasystems.com` addresses and cannot
use the new sign-in sheet. Default in SPEC 9.3: managers re-invite those
people, and the team list badges them `Needs a new invite`. The alternative
is a one-release migration link at the bottom of the sheet (`Used a name and
PIN before? Update your login`) that runs the old name login once and then
forces an email and password. The default is cheaper and matches "one way
in"; pick the alternative only if the production user count makes
re-inviting painful.

---

## Prompt 1: Codex build

```
You are implementing the approved Smelter auth flow, version C, in the Expo
Router React Native app at /Users/david/Babytuna Systems/smelter. Read
these first, in order, before touching code:

1. AGENTS.md (simulator rules, build gotchas, validation commands)
2. docs/mockups/auth-redesign-2026-09/SPEC.md (the contract)
3. docs/mockups/auth-redesign-2026-09/reference-c.html (open it; every
   control on the phone works, use it to settle any question the spec
   leaves)
4. docs/mockups/app-redesign-2026-09/SPEC.md sections 1, 5 and 7 (the
   Studio tokens, the Sheet, and pushed-screen motion this flow reuses)
5. src/theme/tokens.ts, src/components/ui/Sheet.tsx, eslint-rules/
   (smelter/no-design-drift)

Design: Studio tokens, Glide motion. Build exactly what the reference
shows. Do not invent screens, copy, colours or motion that are not in the
spec or the reference. Where the spec and the reference disagree, the
reference wins; note it in the PR. The smelterpos.com website shown inside
the reference's in-app browser is NOT part of this build; the app only
opens the URL.

Branch and worktree:
- Create branch feat/auth-flow-c from integration/app-store-2.3 (if that
  branch has already merged to main, branch from main instead) in a
  worktree under .claude/worktrees/auth-flow-c. Never work in the main
  checkout.
- If feat/ui-studio-2.4 has merged, use its Sheet, TabBar and tokens as
  they are. If it has not, build the sheet to 2.4 SPEC section 5 values
  inside Sheet.tsx without changing its API, and say so in the report.
- Commit early and often. Do not push, do not open a PR; David does that.

Scope, in this order. Each step ends with typecheck, lint and tests green.

A. Tokens and shared auth primitives (SPEC 1 and 2)
   - Replace the `auth` block in src/theme/tokens.ts with the values in
     SPEC section 1. Update app/(auth)/_layout.tsx contentStyle and the
     auth guard loading state to the page colour; update
     src/__tests__/authScreensContract.test.ts accordingly.
   - AuthScreenShell: page background, 54 top, 20 sides, keyboard
     avoidance. LegalFooter: 12 ink3 `Terms · Privacy` opening the in-app
     browser.
   - New components in src/features/auth/components/: ProviderButtons
     (Google white with the G, Apple ink with the mark), WizardProgress
     (Step n of 3 plus the 4pt track, fill animating over 420ms), an input
     well with the trailing pill, error ring and error line, and the
     requirements list with the pop check. Reuse Button from
     src/components/ui where its variants fit; add a `pill` shape there
     rather than a second button component.
   - Remove every SectionLabel / uppercase label from auth.

B. Welcome and the sign-in sheet (SPEC 3 and 4)
   - Rewrite src/features/auth/WelcomeScreen.tsx: lockup, `Welcome`,
     three option cards at the bottom, footer. No clipboard read here.
   - SignInSheet.tsx on the shared Sheet: providers, `or use email`,
     email and password wells with Show/Hide, disabled-until-filled
     `Sign in`, `Forgot password?`, the error copy in SPEC 4, the Go-key
     guard from the existing contract test, 88% detent on focus.
   - Google through the existing signInWithOAuth. Apple through native
     Sign in with Apple: add expo-apple-authentication, the
     usesAppleSignIn entitlement, and signInWithIdToken. Handle cancel as
     a quiet return.
   - `I'm setting up a restaurant`, Terms and Privacy open
     WebBrowser.openBrowserAsync with dismissButtonStyle 'done' and
     controlsColor accent. Add SIGNUP_URL to src/features/auth/legal.ts.

C. Invite wizard (SPEC 5)
   - New app/(auth)/invite-link.tsx + InviteLinkScreen: paste well with
     the Paste pill (clipboard read on tap only), parseJoinToken
     normalisation, the five error strings, fetchInvitePreview on
     Continue.
   - invite-hello.tsx + InviteHelloScreen becomes step 2: title, card,
     `Yes, sign me in with`, Google, Apple, `Email and password`,
     `Not {name}? Wrong link`. app/join.tsx keeps landing here directly.
   - New app/(auth)/invite-login.tsx + InviteLoginScreen (replaces
     secure-password): email (prefilled and locked when the invite carries
     one), password with Show/Hide and new-password autofill, three rules,
     `Finish`, then Ready. No confirm-password well.
   - X on every step returns to Welcome and resets the onboarding store;
     finishing fades the stack above Ready instead of popping.
   - ReadyScreen: SPEC 6 palette, ring pop, copy per role and location
     group.

D. Backend and removals (SPEC 9)
   - Migration: invites.invited_email (nullable, lower-cased, checked);
     profiles.legacy_name_login boolean default false, set true for every
     profile whose auth email ends in @members.babytunasystems.com.
   - create-invite accepts invited_email; the manager invite screens get an
     optional Email well; fetchInvitePreview returns invitedEmail and
     invitedBy.
   - accept-invite: keep email+password mode; add link mode (authenticated
     caller, token only, 409 already_on_team); delete the onboarding mode
     with the synthetic address and the p_kind/p_secret credential RPC.
     Update the local edge-function tests and
     src/__tests__/invitesAccept.test.ts, inviteJoin.test.ts,
     invitePreview.test.ts, onboardingStore.test.ts.
   - Delete the routes, screens, components and tests listed in SPEC 9.4,
     the signInWithName path in authStore, and the access-code client code.
     `grep -rn "PinPad\|login-with-name\|acceptInviteOnboarding\|
     validate-access-code\|(auth)/signup\|(auth)/sign-in\|(auth)/login\|
     (auth)/secure" src app` must be empty.
   - Team list: badge `Needs a new invite` on legacy_name_login profiles.
   - Do not deploy edge functions or apply the migration to production;
     run them on the local stack (scripts/local-db, see AGENTS.md) and
     list the deploy order in BUILD-REPORT.md.

Validation (report exact commands and honest output in the final message
and in docs/mockups/auth-redesign-2026-09/BUILD-REPORT.md):
- npm run typecheck
- npm run lint
- npm run test:ci
- Local stack: the accept-invite link mode and email mode against the
  local Supabase, with the commands you used.
- Simulator: scripts/sim.sh assert, then
  npx expo run:ios --device "$(scripts/sim.sh udid)" with Metro on port
  8091 (npx expo start --port 8091). Walk SPEC section 10 items 1 to 16
  and save a screenshot per item under
  docs/mockups/auth-redesign-2026-09/build-captures/ using
  scripts/sim.sh io screenshot. Name them 01-welcome.png ...
  16-no-legacy-routes.png. Items 5 and 11 need real Google and Apple
  provider config; if the project does not have it yet, capture the
  provider sheet opening and say in the report that the round trip was
  not exercised.

Known traps:
- The repo path has a space. expo run:ios needs the quoting patches
  described in AGENTS.md; two live in node_modules and vanish after
  npm install.
- Never pass "booted" to simctl. Use scripts/sim.sh only. Do not touch
  UDID 7C0CA22A-4895-44BA-BF7E-F53BB5CAF7F8.
- The production edge functions import supabase-js from esm.sh with
  ?no-dts; keep that suffix on any import you touch.
- The prod API key is the sb_publishable_ key; the legacy anon key 401s
  on invite accept.
- Two invite hosts exist in code (tips.babytunasystems.com and
  smelterpos.com). parseJoinToken must keep accepting both; do not change
  the join URL the create-invite function emits.
- The brand rule: the lockup ships exactly as delivered, no recolour, no
  container. Only the width is set (112).
- Status colours (good, warning, alert) never colour a button, chip or
  title. The requirement check is the only green in auth.
- No em dashes in user-facing copy, commit messages or the report.

If something in the spec cannot be built as described (a native Apple
limitation, a navigation constraint, a Supabase provider gap), build the
closest thing, keep the timing and easing, and list every deviation in
BUILD-REPORT.md under "Deviations". Do not silently substitute.
```

---

## Prompt 2: Claude verification and fix

```
You are verifying Codex's implementation of the Smelter auth flow, version
C, in the worktree at .claude/worktrees/auth-flow-c (branch
feat/auth-flow-c) of /Users/david/Babytuna Systems/smelter.

The reference is docs/mockups/auth-redesign-2026-09/reference-c.html
(open it in the Browser pane; every control works) and the contract is
docs/mockups/auth-redesign-2026-09/SPEC.md. Codex's own report is
docs/mockups/auth-redesign-2026-09/BUILD-REPORT.md with screenshots under
build-captures/. The smelterpos.com website inside the reference is out of
scope; only the in-app browser hand-off is verified.

Do this in order:

1. Read AGENTS.md, SPEC.md and BUILD-REPORT.md. Note every deviation
   Codex declared and the edge-function deploy order it listed.
2. Re-run the checks yourself: npm run typecheck, npm run lint,
   npm run test:ci. Report red as red.
3. Bring up the local stack and exercise accept-invite in both modes
   (email+password, and link mode after a session exists) plus the two
   rejections (already_on_team, expired). Confirm the synthetic
   members.babytunasystems.com path is gone from the function.
4. Build and launch on the Release QA simulator by UDID
   (scripts/sim.sh assert; npx expo run:ios --device "$(scripts/sim.sh
   udid)"; Metro on 8091). Walk SPEC section 10 items 1 to 16 yourself.
   For each item take your own screenshot with scripts/sim.sh io
   screenshot and open the reference page to the same state side by side.
5. Compare against the spec numerically where you can: read the rendered
   styles in code (tokens.ts auth block, well height and radius, button
   height and pill radius, progress timings, sheet detent) and against the
   screenshot visually (spacing, copy strings, glyphs, which control
   opens a sheet vs pushes, no uppercase labels anywhere in auth).
6. Adversarial pass on the auth changes: the link mode must not let a
   signed-in user with an existing role consume an invite; an expired or
   used token must fail before any account is created; the clipboard is
   read only on the Paste tap; no secret, token or email is logged.
   Record findings with file:line and a failure scenario.
7. Write docs/mockups/auth-redesign-2026-09/VERIFY-REPORT.md: a table with
   one row per checklist item, columns Item / Matches reference / Drift
   found (file:line, what differs, expected vs actual) / Fixed. Include
   the adversarial findings and a "Not verifiable on simulator" section
   for anything you could not exercise (provider round trips without
   credentials, for example) and say why.
8. Fix every drift you found in the worktree, smallest change first,
   re-run the three checks and re-capture the affected screenshot.
   Commit each fix separately with a message naming the spec section.
   Do not widen scope beyond the drift list; do not refactor.
9. Final message: done / remaining / what David should look at on the
   simulator, and the exact commands you ran with their results.

Rules: review reads code and screenshots, it does not trust
BUILD-REPORT.md claims. Never pass "booted" to simctl. Do not touch UDID
7C0CA22A-4895-44BA-BF7E-F53BB5CAF7F8. Do not push, do not open a PR, do
not deploy edge functions or apply migrations to production.
```

---

## What David does between the two prompts

1. Decide the open question above, or accept the default.
2. Configure the Google and Apple providers in the Supabase dashboard and
   the Apple developer portal (SPEC 9.1). Codex cannot do this; without it
   items 5 and 11 of the checklist stay "provider sheet opens" only.
3. Run Prompt 1 in Codex (Sol, xhigh). Codex cannot push or use gh; the
   commits stay in the worktree.
4. Run Prompt 2 in a Claude session (Opus or Fable).
5. Read VERIFY-REPORT.md, then push and open the PR yourself. Deploy order
   after merge: migration, create-invite, accept-invite, then the app
   build. The old login-with-name function can be deleted once no
   legacy_name_login profiles remain.
