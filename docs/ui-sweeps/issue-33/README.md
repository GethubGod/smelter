# Issue #33: auth and setup screens on the UI contract

Before and after for every auth screen this sweep touched.

- Before: the existing capture from `docs/release-readiness/e2e/` named in the
  table. Those were taken from the integration build before this branch.
- After: captured from this branch's Debug build (`e2d1276`) on the second
  simulator, UDID `493660C2-D09B-4B39-AC50-705FFD205948`, Metro on port 8091,
  against the shared local stack on `http://127.0.0.1:54601`. Screens were
  reached with `xcrun simctl openurl` deep links into the app's `babytunasystems://`
  scheme (e.g. `babytunasystems:///secure-pin`) rather than by tapping through
  the flow, since this pass ran with simctl-only device access.

| Screen | Route | Before | After |
| --- | --- | --- | --- |
| Welcome | `/(auth)/welcome` | `docs/release-readiness/e2e/issue-40/01-launch-welcome.png` | `after/01-welcome.png` |
| Name sign-in | `/(auth)/sign-in` | `docs/release-readiness/e2e/issue-40/02-signin.png` | `after/02-sign-in.png` |
| Legacy login | `/(auth)/login` | `docs/release-readiness/e2e/root-legacy-login-fixed.png` | `after/03-legacy-login.png` |
| Sign up | `/(auth)/signup` | `docs/release-readiness/e2e/root-legacy-signup.png` | `after/04-signup.png` |
| Invite hello | `/(auth)/invite-hello` | `docs/release-readiness/e2e/issue-39/01-auth-invite-hello.png` | `after/05-invite-hello.png` |
| Secure your app | `/(auth)/secure` | `docs/release-readiness/e2e/issue-39/02-auth-secure.png` | `after/06-secure.png` |
| Secure with PIN | `/(auth)/secure-pin` | `docs/release-readiness/e2e/issue-39/03-auth-secure-pin.png` | `after/07-secure-pin.png` |
| Secure with password | `/(auth)/secure-password` | `docs/release-readiness/e2e/issue-39/04-auth-secure-password.png` | `after/08-secure-password.png` |
| Ready | `/(auth)/ready` | `docs/release-readiness/e2e/issue-39/05-auth-ready.png` | `after/09-ready.png` |
| Join deep link, no token | `/join` | `docs/release-readiness/e2e/root-join-missing-token.png` | `after/10-join.png` |
| Suspended | `/suspended` | `docs/release-readiness/e2e/issue-39/40-suspended-relaunch.png` | no after capture, see note below |

Notes.

- `/join` is a thin redirect with no UI of its own: with no token it lands on
  Welcome, which is what both the before and the after capture show.
- The invite screens (`invite-hello`, `secure`, `secure-pin`, `secure-password`,
  `ready`) were driven with a real invite row inserted directly into
  `public.invites` (token, name "QA Invite", role employee, created_by the
  manager), opened with `xcrun simctl openurl` on the join link, then each
  step screen was reached by its own deep link.
- Every after capture shows a dev-only "Open debugger to view warnings."
  LogBox toast at the bottom of the screen. It comes from pre-existing,
  unrelated console warnings in this Debug build (a SafeAreaView deprecation
  notice, a require cycle in `src/store`, and an inventory API 404 fallback
  warning), not from anything this sweep changed, and this pass had no
  interactive tool available on this device to dismiss it. It does not cover
  any of the restyled content on these screens.
- Suspended has no fresh after capture. On this branch (forked before
  integration/app-store-2.3's suspended-session-restore fix landed),
  `authStore.ts`'s `refreshProfileAndHandleSuspension` signs a suspended
  profile out immediately on both explicit sign-in and session restore, so
  `app/suspended.tsx`'s guard (`session` present and `profile.is_suspended`)
  never sees a matching state to render through normal app flow. Reaching it
  would need either an interactive tool to sign in and drive the flow (not
  available for this device in this pass) or a temporary behavior change to
  authStore.ts (out of scope for a restyle-only sweep). The screen's contract
  compliance (EmptyState, Button, tokens) was verified by reading
  `app/suspended.tsx` directly instead. Flagging as a follow-up.
