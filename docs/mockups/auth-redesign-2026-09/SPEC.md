# Smelter auth, version C: Welcome, sign-in sheet, invite wizard

Approved by David on Sep 13 2026. This document is the written contract for
the interactive reference at `reference-c.html` in this folder. When the two
disagree, the HTML wins; file the discrepancy against this document.

Scope: the launch (welcome) screen, the sign-in sheet, the three-step invite
onboarding, the Ready screen, the in-app browser hand-off to
smelterpos.com, the removal of in-app account creation and name-plus-PIN
sign-in, and the backend changes those need. The smelterpos.com sign-up
website itself is out of scope and ships separately; the app only opens it.

All values are iOS points. Every value maps to `src/theme/tokens.ts`; where a
value is new, the section says so and the token must be added there, not
written inline (ESLint `smelter/no-design-drift`).

---

## 1. Tokens

Auth surfaces stop being black. They use the Studio page tokens from
`docs/mockups/app-redesign-2026-09/SPEC.md` section 1 so launch and the
Order tab read as one product. The `auth` block in `tokens.ts` is replaced,
not extended:

| Token | Value | Notes |
|---|---|---|
| auth.bg | `#F3F3F1` | = color.page. Was `#000000` |
| auth.text | `#1A1A1A` | = ink |
| auth.dim | `#5F5F5F` | = ink2. Was white at 55% |
| auth.faint | `#9C9890` | = ink3. new |
| auth.well | `#FFFFFF` | inputs and cards. Was white at 9% |
| auth.wellFocus | `#1A1A1A` | 1.5 inset ring on focus. new |
| auth.wellError | `#C03520` | 1.5 inset ring on error. new |
| auth.accent | `#E84D38` | unchanged |
| auth.disabled | `#C9C5BC` | disabled primary button |
| auth.hair | `rgba(0,0,0,.10)` | the "or" divider line. new |

Radii: control 14 (inputs, cards inside sheets), card 22, sheet 30, button
999 (pill). Motion tokens `ease = cubic-bezier(.2,.8,.2,1)`, `dur = 280ms`,
`pop = cubic-bezier(.34,1.5,.64,1)`, shared with 2.4.

Type: system font, weights 400, 600, 700 only.

| Role | Size / weight | Colour | Used for |
|---|---|---|---|
| display | 30 / 700 / tracking -0.9 / line 1.1 | ink | screen titles, `Welcome` |
| sub | 13 / 400 / line 1.45 | ink2 | the line under a title |
| field label | 13 / 400 | ink2 | `Invite link`, `Email`, `Password`. 16 above, 6 below |
| divider | 12 / 400 | ink3 | `or use email`, `Yes, sign me in with`; hairline either side, 12 gap |
| hint | 12 / 400 / line 1.4 | ink3 | clipboard note, autofill note |
| link | 14 / 600 | ink | `Email and password` |
| link, quiet | 14 / 500 | ink2 | `Forgot password?` |
| footer | 12 / 400 / line 1.5 | ink3 | Terms · Privacy, `Not Maya? Wrong link` |
| button | 15 / 600 | per button | |
| option title | 16 / 700 | ink | welcome cards |
| option sub | 13 / 400 | ink2 | welcome cards |
| card row key | 13 / 400 | ink2 | `Restaurant`, `Role`, `Invited by` |
| card row value | 14 / 600 | ink | `Babytuna Sushi` |
| step counter | 12 / 600 | ink2 | `Step 1 of 3` |

The uppercase caption label (11/700, letter-spaced, `SectionLabel`) is not
used anywhere in auth. Delete every `SectionLabel` and uppercase `label`
from the auth screens; field labels are the 13/400 ink2 style above.

---

## 2. Shared anatomy

- Status bar area 54. Screen content starts at 54 with 20 side padding.
- Input well: 50 tall, radius 14, white, 14 side padding, text 15/500 ink,
  placeholder 15/400 ink3. Focus draws a 1.5 inset ring in ink over 160ms.
  Error draws the same ring in alert and shows a 13/400 alert line 8 below
  the well (max height animates 0 → open over `dur`). Wells stack with 10
  between them. A trailing pill inside the well (`Paste`, `Show`, `Hide`) is
  12/600 ink on `well` `#EAEAE8`, 6×10 padding, radius 999.
- Buttons: 52 tall, full width, radius 999, 15/600, glyph 18 with 10 gap.
  - primary: accent bg, white text. Disabled: `#C9C5BC` bg, white text,
    not pressable.
  - ink: `#1A1A1A` bg, white text (Apple, and `Email and password` on step 2
    of the invite wizard is a link, not this).
  - white: white bg, ink text, 1 inset `rgba(0,0,0,.08)`.
  - press: scale .98 over 90ms. Busy: label hidden, 20pt spinner in the
    label colour, not pressable, until the request settles.
  - Stacked buttons have 10 between them.
- Provider glyphs: the Google "G" in its four colours at 18; the Apple mark
  at 18 in the button's text colour. No other icons on buttons.
- Circle X: 30 white circle, 14 ink X glyph, top right, 4 below the status
  bar area, 14 above the next element. Press scale .92. The same element in
  the sheet header and on every wizard step. There is no chevron back on
  wizard steps.
- Footer: pinned to the bottom with 30 bottom padding, centred, 12 ink3.
  Welcome shows `Terms · Privacy`, both underlined, opening
  `TERMS_URL` / `PRIVACY_URL` from `src/features/auth/legal.ts` in the
  in-app browser.
- Toast: ink pill, white 13/600, 11×16 padding, radius 14, 120 above the
  bottom, rises 10 and fades in over 220ms, gone after 1.8s.
- Keyboard: `KeyboardAvoidingView` on every screen with a well. The sheet
  lifts to its 88% detent when a well inside it takes focus.

---

## 3. Welcome (route `/(auth)/welcome`, the cold-start screen for signed-out users)

Top to bottom, on `auth.bg`:

1. Lockup `assets/images/smelter-lockup.png`, 112 wide, centred, 22 below
   the status bar area. Shipped as delivered, no recolour, no container.
2. Empty space (flex).
3. `Welcome` in display, 22 above the first card. No subtitle. No question.
4. Three option cards, white, radius 22, 16 padding (18 left), 10 apart,
   each with a 28 `well`-coloured circle on the right holding a 15 glyph:
   - `I was invited` / `Paste the link your manager sent` · chevron-right ·
     pushes step 1 (section 5).
   - `I have an account` / `Google, Apple, or email` · chevron-right ·
     opens the sign-in sheet (section 4).
   - `I'm setting up a restaurant` / `Create your account on smelterpos.com`
     · arrow-up-right (leaves the app) · opens `https://smelterpos.com/signup`
     in the in-app browser (section 7).
   Press: scale .985 over 90ms, background to `#FBFBFA`.
5. Footer `Terms · Privacy`.

There is no `Sign in` button, no `Sign up` link, no name field, no PIN, no
clipboard read. Welcome shows again after sign-out.

---

## 4. Sign-in sheet

The Sheet component from `src/components/ui/Sheet.tsx` (2.4 section 5:
page-coloured, top radius 30, sheet shadow, 320ms slide, 240ms scrim,
drag to dismiss past 90pt, X closes). Not expandable by drag; it moves to
the 88% detent only when a well takes focus, and returns when the keyboard
dismisses.

Content, 20 side padding, 30 bottom padding:

1. Header: `Sign in` 20/700 tracking -0.2 left, circle X right.
2. `Continue with Google` white button with the G.
3. `Continue with Apple` ink button with the Apple mark.
4. Divider `or use email`.
5. Well `Email` placeholder, email keyboard, autocomplete username.
6. Well `Password` placeholder with the `Show` / `Hide` pill, autocomplete
   current-password (iCloud Keychain fills both).
7. Error line (hidden until needed).
8. `Sign in` primary, 14 above. Disabled until both wells have text.
9. `Forgot password?` quiet link, 12 below, centred.

Behaviour:

- Google and Apple call `signInWithOAuth('google' | 'apple')`; the button is
  busy until the session exists, then the sheet closes and Ready shows
  (section 6). Cancelling the provider sheet returns to the sheet with no
  error.
- `Sign in` calls `supabase.auth.signInWithPassword`. Wrong credentials:
  error line `That password doesn't match. Try again or reset it.` and the
  password well gets the alert ring; the ring and line clear on the next
  keystroke. A network failure: `Can't reach smelter. Check your connection
  and try again.` The Go key on the keyboard is the same as the button and
  cannot dispatch a second request while one is in flight (existing
  contract test).
- `Forgot password?` with a valid email in the well calls
  `supabase.auth.resetPasswordForEmail(email)` and toasts
  `Reset link sent to {email}`; with an empty or invalid email it toasts
  `Enter your email first` and focuses the email well.
- An account that has no password (Google or Apple only) gets the wrong
  password error; the reset email sets one. No account-lookup endpoint.

---

## 5. Invite wizard (routes `/(auth)/invite-link`, `/(auth)/invite-hello`, `/(auth)/invite-login`)

Three pushed screens over Welcome, each with the circle X top right, then a
progress row 22 above the title: `Step n of 3` 12/600 ink2 left, a 4 tall
`well`-coloured track with an accent fill at 33 / 67 / 100%, the fill
animating over 420ms `ease` when a step appears.

X on any step returns to Welcome and clears the onboarding store. Pushes
slide in from the right over `dur`; the layer underneath parks at -24%
with brightness .92 (2.4 section 7). Finishing (section 6) fades the whole
stack out over 240ms above the Ready screen; it does not pop back
step by step.

### 5.1 Step 1, Link (`invite-link`)

- Title `Paste your invite link`. Sub `Your manager sent it by text or email.`
- Field label `Invite link`. Well with placeholder `smelterpos.com/join/…` and
  the `Paste` pill. `Paste` reads the clipboard once, on tap, and fills the
  well with a 500ms tint flash. The well accepts a whole join URL or a bare
  token; `parseJoinToken` from `src/services/inviteLinks.ts` normalises it.
  Autocorrect off, no capitalisation, URL keyboard.
- Hint `The clipboard is only read when you tap Paste.` 8 below the well.
- `Continue` primary, 18 below the hint. Disabled while the well is empty.
  On tap: busy while `fetchInvitePreview(token)` runs.
- Errors, shown as the alert ring plus line under the well:
  - not a link or token: `That doesn't look like an invite link. Paste the
    whole link from your manager.` (no request made)
  - expired: `This invite has expired. Ask {manager first name} to send a new
    one.`
  - used: `This invite was already used. Ask {manager first name} for a new
    one if that wasn't you.`
  - revoked or invalid: `This invite isn't valid any more. Ask your manager
    for a new link.`
  - network: `Can't reach smelter. Check your connection and try again.`
- Opening a join link from Messages or Mail (`app/join.tsx`) skips this
  screen and lands on step 2 with the progress row already at 67%.

### 5.2 Step 2, Confirm (`invite-hello`)

- Title `Is this you, {invited first name}?`. Sub `{manager first name}
  invited you to {restaurant} as a {role, lower case}.`
- Card, white, radius 22, 4×16 padding, three rows with hairlines:
  `Restaurant` / `{restaurant}`, `Role` / `{Role}`, `Invited by` /
  `{manager name with initial}`. Rows are 12 tall padding, key 13 ink2 left,
  value 14/600 right.
- Divider `Yes, sign me in with`.
- `Google` white button with the G. `Apple` ink button with the mark.
- `Email and password` link, 12 below, centred.
- Footer `Not {name}? Wrong link`, `Wrong link` underlined, returns to step 1
  (pop, not X).

Restaurant comes from the invite's `location_group` (`sushi` →
`Babytuna Sushi`, `poki` → `Babytuna Poki & Pho`, `both` → `Babytuna`).
Manager name comes from the invite preview (section 9 adds it).

Google or Apple: `signInWithOAuth`, then `acceptInvite` in link mode
(section 9) for the now-authenticated user, then Ready. If the provider
sheet is cancelled the button returns to rest with no error. If link mode
fails because the account already belongs to a team, show a toast
`That account is already on a team. Sign in instead.` and stay on step 2.

### 5.3 Step 3, Create your login (`invite-login`)

- Title `Create your login`. Sub `You'll use this in the Sign in sheet next
  time.`
- Field label `Email`. Well, email keyboard. Prefilled and read-only when the
  invite carries `invited_email`; otherwise empty with placeholder
  `you@example.com`.
- Field label `Password`. Well with `Show` / `Hide`, autocomplete
  new-password so iCloud Keychain offers a strong password and saves it.
- Requirements list 12 below the well, 13/400 ink2, 4 row padding, an 18
  ring on the left (1.5 ink3 ring; met = `good` `#22883E` fill with a white
  11 check that pops in over 320ms `pop`, and the row text turns ink):
  - `At least 8 characters`
  - `A letter and a number`
  - `Not a common password` (met once the value is non-empty and not in the
    common list already used by the current SecurePasswordScreen)
- `Finish` primary, 18 below. Disabled until the email is valid and all
  three rules are met.
- Hint, centred, 8 below the button: `Saved to iPhone autofill, so you
  won't retype it.`
- There is no confirm-password well.
- On tap: busy while `acceptInvite({ token, email, password })` runs, then
  Ready. Errors under the email well: `That email already has a smelter
  account. Sign in instead.`; under the password well for a server-side
  password rejection; network as above.

---

## 6. Ready (route `/(auth)/ready`)

Unchanged structure, new palette: an 88 accent-tint ring 80 below the
status area with a 40 accent check, scaling .6 → 1 over 460ms `pop` as the
screen appears; title `You're set, {first name}`; sub `Your Sushi order list
is ready.` / `Your Poki & Pho order list is ready.` / `Your order list is
ready.` per location group (manager: `Your team is ready.`); primary
`See today's list` (manager: `Open your dashboard`) pinned at the bottom
with 30 padding. Tapping replaces the stack with the role home.

Ready follows every successful path: sheet sign-in (Google, Apple, email),
wizard via Google or Apple from step 2, and wizard via step 3. Sheet
sign-in of an existing user shows Ready for one beat as the reference
does; if the product later wants to skip it for returning users, that is a
one-line change in the auth guard, not a design change.

---

## 7. Setting up a restaurant (app side only)

`I'm setting up a restaurant` on Welcome and both legal links call
`WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'done',
controlsColor: accent })`: the default full-screen SFSafariViewController,
not a form sheet. The URL is `https://smelterpos.com/signup` from a new
`SIGNUP_URL` in `legal.ts`. Nothing in the app waits for the
browser; when the person taps Done they are back on Welcome and use
`I have an account`.

The website itself (create account, name the restaurant, done) is a
separate deliverable. The reference shows it so the hand-off reads as one
flow; do not build it in this repo.

---

## 8. Motion

| Moment | Spec |
|---|---|
| Welcome → sheet | Sheet 320ms `ease` slide from 105%; scrim 240ms |
| Well focus in sheet | Sheet to 88% over 320ms `ease` |
| Welcome → step 1, step n → n+1 | Push from right over `dur`; underlying layer to -24% and brightness .92 |
| Wrong link, X | Pop over `dur` (reverse); X pops the whole stack at once |
| Progress fill | width over 420ms `ease` |
| Requirement met | ring fill 280ms, check scale 0 → 1 over 320ms `pop` |
| Paste | well background tint → white over 500ms `ease` |
| Error line | max-height and opacity over `dur` |
| Finish / provider success → Ready | Ready fades in with a 10pt rise over 300ms `ease`; wizard stack or sheet fades out over 240ms above it |
| Ready ring | scale .6 → 1 over 460ms `pop` |
| Ready → home | 2.4 Glide page change |
| Button press | scale .98 over 90ms; circle X .92 |

Nothing else animates. No overshoot outside `pop`. Respect Reduce Motion:
durations to 1ms.

---

## 9. Backend and data

### 9.1 OAuth providers
- Enable Google and Apple providers on the Supabase project. Google: iOS
  client ID and the web client ID/secret the provider needs; Apple: Services
  ID, team ID, key ID and the .p8 key. Both redirect to the existing
  `OAUTH_REDIRECT_URI` in `authStore.ts`.
- Google uses the existing `signInWithOAuth` web flow through
  `WebBrowser.openAuthSessionAsync`.
- Apple uses native Sign in with Apple: add `expo-apple-authentication`
  (reason: App Store guideline 4.8 and Apple's native button requirement on
  iOS), call `AppleAuthentication.signInAsync` with full name and email
  scopes, then `supabase.auth.signInWithIdToken({ provider: 'apple',
  token: identityToken })`. Add the `usesAppleSignIn` entitlement in
  app.json. Apple only returns the name on the first sign-in; write it to the
  profile then.
- Provider display name → profile name on first sign-in; the invite's
  `invited_name` wins when both exist.

### 9.2 Invites
- Migration: `alter table public.invites add column invited_email text`
  (nullable, lower-cased, checked against a simple email pattern). The
  manager invite screens get an optional `Email` well; the create-invite edge
  function accepts and stores it. `fetchInvitePreview` returns
  `invitedEmail` and `invitedBy` (the creator's display name from
  `profiles`), so steps 2 and 3 can show them.
- `accept-invite` keeps its existing email + password mode (creates the auth
  user with `provider: 'email'`, applies the invite). Add a **link** mode:
  an authenticated request with only `token`; the function applies the
  invite to the caller's `auth.uid()` (profile, role, module preset,
  location group) and marks the invite used by that user. Reject with 409
  `already_on_team` when the caller already has a profile with a role.
- Remove the onboarding mode that mints `join-{id}@members.babytunasystems.com`
  with a discarded password, and the `p_kind` / `p_secret` PIN or password
  credential RPC behind it. `acceptInviteOnboarding` in
  `src/services/invites.ts` and `useOnboardingStore.accept` go with it; the
  onboarding store keeps only `token`, `preview`, `reset`.

### 9.3 Retire name and PIN sign-in
- Delete the `login-with-name` edge function call path from `authStore`
  (`signInWithName` or equivalent), `NameSignInScreen`, `SecureAppScreen`,
  `SecurePinScreen`, `PinPad`, `PinDots` and their tests.
- Existing accounts created under the synthetic members domain cannot use
  the new sheet. Default decision: managers re-invite those people from the
  team screen; a migration adds `profiles.legacy_name_login boolean` so the
  team list can badge them `Needs a new invite`. See HANDOFF for the open
  question.
- `validate-access-code` and `update-access-codes` (the sign-up access code)
  lose their only caller. Leave the functions deployed; remove the client
  code that called them.

### 9.4 Routes and files
Delete: `app/(auth)/login.tsx`, `signup.tsx`, `sign-in.tsx`, `secure.tsx`,
`secure-pin.tsx`, `secure-password.tsx` (replaced by `invite-login.tsx`),
`src/features/auth/NameSignInScreen.tsx`, `SecureAppScreen.tsx`,
`SecurePinScreen.tsx`, `SecurePasswordScreen.tsx`,
`components/PinPad.tsx`, `components/StepProgress.tsx` (replaced by the
3-step progress row).

Keep and rewrite: `welcome.tsx` / `WelcomeScreen.tsx`, `invite-hello.tsx` /
`InviteHelloScreen.tsx`, `ready.tsx` / `ReadyScreen.tsx`,
`components/AuthScreenShell.tsx` (page colour, 20 padding, keyboard
avoidance), `components/LegalFooter.tsx` (12 ink3, Terms · Privacy only).

New: `app/(auth)/invite-link.tsx`, `app/(auth)/invite-login.tsx`,
`src/features/auth/InviteLinkScreen.tsx`, `InviteLoginScreen.tsx`,
`components/SignInSheet.tsx`, `components/WizardProgress.tsx`,
`components/ProviderButtons.tsx` (Google and Apple, used by the sheet and
step 2).

Every `router.push('/(auth)/signup')`, `'/(auth)/sign-in'`,
`'/(auth)/login'`, `'/(auth)/secure*'` reference across the app is removed
or repointed (`grep -rn "(auth)/" app src`). The auth guard's signed-out
redirect stays `/(auth)/welcome`. The `_layout.tsx` contentStyle uses the
new `auth.bg`; the loading state in the guard is page-coloured through the
Loading primitive (update `authScreensContract.test.ts` from black to
page).

---

## 10. Acceptance checklist (for the verifying agent)

Run on the Release QA simulator by UDID. For each line, capture a screenshot
and compare with the reference page at the same state.

1. Cold start signed out: Welcome exactly as section 3. Lockup 112 wide,
   `Welcome`, three cards at the bottom, Terms · Privacy. No other text.
2. `I have an account`: sheet slides up in 320ms with no bounce; Google,
   Apple, `or use email`, two wells, disabled `Sign in`, `Forgot password?`.
3. Focus the email well: sheet moves to 88%. Type an email and a wrong
   password; `Sign in` enables; tap: spinner, then the alert ring and `That
   password doesn't match. Try again or reset it.` Typing clears it.
4. Correct password: spinner, sheet closes, Ready with the ring pop, `See
   today's list` lands on the Order tab (employee) or Home (manager).
5. `Continue with Google` in the sheet completes through the provider and
   lands on Ready. `Continue with Apple` uses the native Apple sheet.
   Cancelling either returns to the sheet with no error.
6. `Forgot password?` with an email toasts `Reset link sent to …`; with none
   toasts `Enter your email first`.
7. Drag the sheet down past 90pt: it closes. Tap the scrim: it closes. X: it
   closes.
8. `I was invited`: step 1 pushes from the right, Welcome parks at -24%.
   Progress at 33%. `Continue` disabled. Type junk: the no-request error.
9. `Paste` with a join link on the clipboard fills the well with the tint
   flash; `Continue` spins and step 2 appears with the fill animating to
   67%. With an expired token the expired error shows under the well and no
   step 2.
10. Step 2 shows the name, restaurant, role and inviter from the invite;
    `Wrong link` pops to step 1; X returns to Welcome and the onboarding
    store is empty.
11. Step 2 `Google` completes the provider flow, applies the invite in link
    mode, and lands on Ready with the wizard fading out, not popping.
12. `Email and password`: step 3 at 100%. Rules tick with the pop as you
    type; `Finish` enables only when all three are met and the email is
    valid; `Finish` spins and lands on Ready. iCloud Keychain offers to save.
13. A join link opened from Messages lands on step 2 directly with the
    progress at 67%.
14. `I'm setting up a restaurant` opens smelterpos.com/signup in
    SFSafariViewController with a `Done` button in accent; Done returns to
    Welcome. Terms and Privacy open the same way.
15. Sign out from Settings returns to Welcome, not to a sign-in form.
16. There is no route, link or button that reaches a name field, a PIN pad,
    an access code, or an in-app Create Account form. `grep -rn "PinPad\|
    login-with-name\|acceptInviteOnboarding\|validate-access-code" src app`
    is empty.
17. `npm run typecheck`, `npm run lint`, `npm run test:ci` green, with the
    replaced `auth` tokens and no `no-design-drift` suppressions.
