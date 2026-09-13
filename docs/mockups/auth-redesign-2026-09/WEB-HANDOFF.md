# Handoff: smelterpos.com/signup (the "I'm setting up a restaurant" page)

One prompt for the agent that builds the website side of the auth flow, and
a short verification list. It is independent of the app build in
`HANDOFF.md`; the only contract between them is the URL
`https://smelterpos.com/signup`, which the app opens in an in-app browser.

Reference: `reference-c.html` in this folder. Tap `I'm setting up a
restaurant` on the phone; the three pages inside the Safari view are the
visual reference for this page (layout, spacing, copy, the three-bar
progress, the done state). The reference mocks a self-serve account; the
decision below changes what the form does, not how it looks.

## Decision (David, Sep 13 2026): request access, David provisions

The backend is single-tenant today: one fixed org id in `org_settings`,
locations hardcoded to `sushi` and `poki`, and `profiles.org_id` was dropped
in March because there are no organizations. Self-serve restaurant creation
needs multi-tenancy first, and that is not this task.

So `/signup` collects a workspace request. Nothing is created in
`auth.users`. David reviews requests in the manager dashboard
(`dashboard.smelterpos.com`) and approves one by creating a manager invite;
the owner then joins through the app's invite wizard like anyone else. When
multi-tenancy lands, the same form starts provisioning for real.

Consequences for the page versus the reference:
- No `Continue with Google` and no password field. The form is name, work
  email, phone (optional), then restaurant details.
- The done page promises an invite link by email within one business day,
  not "your trial started".

---

## Prompt: build smelterpos.com/signup

```
You are building the sign-up request page for smelter at
https://smelterpos.com/signup, in the repo at
/Users/david/Babytuna Systems/smelter. Read these first, in order:

1. AGENTS.md at the repo root (git rules, validation, no em dashes)
2. docs/mockups/auth-redesign-2026-09/WEB-HANDOFF.md (this file: the
   decision at the top changes what the form does)
3. docs/mockups/auth-redesign-2026-09/reference-c.html: open it in a
   browser, tap "I'm setting up a restaurant", and walk the three pages
   inside the in-app browser. That is the visual reference.
4. marketing/ (the Next.js 16 app that serves smelterpos.com; Vercel
   project smelter-marketing, root dir marketing), its globals.css tokens
   and src/components, and marketing/src/app/support/page.tsx as the
   pattern for a content page.
5. web/AGENTS.md and web/src/app/manager (the tips/dashboard Next app on
   dashboard.smelterpos.com, Supabase auth for managers) for the approval
   UI.
6. supabase/functions/tip-entry-auth/index.ts for the anonymous
   edge-function pattern (verify_jwt=false, service-role client inside,
   rate-limit table) and supabase/config.toml for how functions are
   declared.

Branch and worktree:
- Create branch feat/web-signup-request from main in a worktree under
  .claude/worktrees/web-signup-request. Never work in the main checkout.
- Commit early and often. Do not push, do not open a PR, do not deploy;
  David does that.

Scope, in this order. Each step ends with the checks for that app green.

A. Data and function (repo root: supabase/)
   - Migration supabase/migrations/<timestamp>_workspace_requests.sql:
     table public.workspace_requests (id uuid pk default gen_random_uuid(),
     full_name text not null, email text not null (lower-cased, simple
     pattern check), phone text, restaurant_name text not null, city text,
     primary_category text check in ('fish','produce','dry_goods',
     'packaging'), locations_count smallint not null default 1 check
     between 1 and 20, status text not null default 'pending' check in
     ('pending','approved','declined'), invite_id uuid references
     public.invites(id), reviewed_by uuid references auth.users(id),
     reviewed_at timestamptz, ip_hash text, user_agent text, created_at
     timestamptz not null default now()). Index on (status, created_at
     desc) and on lower(email). RLS on; revoke all from anon and
     authenticated; grant select, update to authenticated with a policy
     limited to profiles.role = 'manager'. Inserts happen only through the
     service role.
   - Edge function supabase/functions/request-workspace/index.ts,
     verify_jwt=false in config.toml with a comment like the others.
     POST JSON {fullName, email, phone?, restaurantName, city?,
     primaryCategory?, locationsCount, website?}. `website` is a honeypot:
     if present and non-empty, return 200 {ok:true} and store nothing.
     Validate lengths and the email pattern; 400 on failure with a
     field-keyed error. Rate limit: 5 per hashed IP per hour and 2 per
     email per day using a workspace_request_rate_limits table in the same
     migration, following the tip-entry-auth pattern; 429 with
     {error:'rate_limited'}. Insert with the service-role client. Return
     {ok:true, id}. Import supabase-js from esm.sh with the ?no-dts suffix
     like the other functions. Add a Deno test next to it for the
     validator and the honeypot.
   - Do not apply the migration or deploy the function to production. Run
     both on the local stack (scripts/local-db, see AGENTS.md) and put the
     deploy order in the report.

B. The page (marketing/)
   - Route marketing/src/app/signup/page.tsx with a client form component
     under marketing/src/components/signup/. Mobile first: it is opened
     inside SFSafariViewController on an iPhone, so design at 375 wide and
     let it widen to a 440 max-width card on desktop, centred on the cream
     page. Use the existing tokens (cream, card, accent, tint, ink, ink2,
     ink3, hairline, radius-card) and the Logo component. No new colours,
     no shadows, no gradients.
   - Three states, matching the reference pages one for one except for the
     decision above:
     1. Account: Logo row with a "Sign in" text link on the right to
        https://dashboard.smelterpos.com. Three-bar progress (first bar
        accent). Title "Create your account" 26/700 tracking -0.7. Sub
        "Free for 14 days, no card needed. You'll invite your team once
        you're in." Fields with 13px ink2 labels above 46px white inputs,
        radius 10, 1px hairline border, focus ring ink at 3px 8% alpha:
        Full name, Work email, Phone (optional). Primary button "Continue"
        48 tall radius 10 accent, disabled at 40% opacity until name and a
        valid email exist. Legal line 11.5px ink3: "By continuing you
        agree to the Terms and Privacy policy." with links to /terms and
        /privacy. Footer "Already have an account? Sign in" to the
        dashboard.
     2. Restaurant: bars one and two accent. Title "Name your restaurant".
        Sub "You can add more locations from the dashboard later." A
        "who" row (30px accent circle with the initial, name bold, email
        under it) echoing step 1. Fields: Restaurant name (required), City.
        Label "What do you mostly order?" with four chips Fish / Produce /
        Dry goods / Packaging, single select, selected = ink fill white
        text. Label "How many locations?" with a 1 to 20 stepper or select.
        Primary "Request access" disabled until the restaurant name exists;
        busy spinner while the request posts. Server errors show under the
        relevant field; rate limit shows "Too many requests from this
        network. Try again in an hour." above the button.
     3. Done: all three bars accent, the 76px green check ring (the only
        green on the page), title "{Restaurant} is on the list", sub
        "Thanks, {first name}. We'll email {email} within one business day
        with your invite link. Open it on your phone and the smelter app
        takes it from there." Primary "Back to smelterpos.com" to /. Under
        it a 13px ink2 line "Questions? support@smelterpos.com" only if
        that mailbox exists; otherwise link to /support.
   - Between states, fade and slide 24px over 240ms ease-out; respect
     prefers-reduced-motion. Keep the URL at /signup (state in React, not
     routes) so the in-app browser's Done button always returns cleanly.
   - Post to the edge function through a Next route handler at
     marketing/src/app/api/signup/route.ts that forwards the body server
     side to ${SUPABASE_URL}/functions/v1/request-workspace with the
     publishable key from env, adds the caller IP for hashing, and never
     exposes the Supabase URL or key to the client. Read env names from
     marketing/.env.example, which you create, and list them for Vercel in
     the report.
   - Metadata: title "Create your account", description one line, noindex
     is NOT set (the page is public). Add /signup to the marketing
     sitemap or nav only if one exists; do not add a nav.
   - Accessibility: labels bound to inputs, error text in aria-live,
     buttons with visible focus, the progress bars aria-hidden with a
     visually hidden "Step n of 3".

C. Approval in the dashboard (web/)
   - On the manager page add a "Workspace requests" card listing pending
     requests newest first: restaurant name, requester name, email, city,
     category, locations, age. Two actions per row: Approve, Decline.
   - Approve calls the existing create-invite function for a manager
     invite (pass invited_email when that field exists; it is added by the
     app handoff in HANDOFF.md, so check the function's input first and
     omit it if not there), stores the returned invite id and status
     'approved' with reviewed_by and reviewed_at on the request, and shows
     the join link with a Copy button and a prefilled mailto: to the
     requester ("Your smelter invite" with the link in the body). David
     sends the email himself; the app has no email provider.
   - Decline sets status 'declined'. Approved and declined rows collapse
     into a "Reviewed" section.
   - Reuse the dashboard's existing card, list and button components and
     its Supabase client. Managers only; the RLS from step A is the real
     gate, the UI is not.

Validation (report exact commands and honest output in the final message
and in docs/mockups/auth-redesign-2026-09/WEB-BUILD-REPORT.md):
- marketing: npm run typecheck, npm run lint, npm run build
- web: npm run typecheck, npm run lint, npm test (whatever web/AGENTS.md
  names)
- root: npm run typecheck and npm run lint must still pass (root
  tsconfig and eslint exclude marketing/ and web/; do not change that)
- supabase: the Deno test for request-workspace; then against the local
  stack, three curl calls: a valid request (201/200 with id), a honeypot
  request (200, no row), a sixth request from one IP inside an hour (429).
  Paste the commands and responses.
- Screenshots via the Browser pane at 375 and 1280 wide for each of the
  three states plus the two error states, saved under
  docs/mockups/auth-redesign-2026-09/web-captures/ as
  01-account-375.png ... 05-rate-limit-1280.png. Open reference-c.html
  beside them.
- Dashboard: screenshot of the requests card with one pending row and the
  approve result showing the join link.

Known traps:
- The repo path has a space; quote paths.
- Two next dev servers cannot run on the same directory; use the Browser
  pane's preview_start with .claude/launch.json entries, one per app, on
  different ports.
- Root tsconfig.json and eslint.config.js must keep excluding marketing/
  and web/ or the mobile typecheck fails on their @/* aliases.
- CI classifies by path: changes under marketing/ run marketing-quality,
  under web/ run the web job, under supabase/ run the mobile job. The
  migration and function live under supabase/, so expect the mobile job
  to run; it must stay green.
- Edge functions import supabase-js from esm.sh with ?no-dts. Keep it.
- The prod API key is the sb_publishable_ key, not the legacy anon key.
- Marketing has no Supabase dependency today. Do not add @supabase/
  supabase-js to marketing; the route handler uses fetch.
- The green check ring is the only status colour on the page. Accent is
  the only action colour. No uppercase section labels on this page (the
  marketing .section-label class exists; do not use it here).
- No em dashes in copy, commit messages or the report.

If something cannot be built as described (a Next 16 constraint, a
dashboard component that does not fit), build the closest thing and list
every deviation in WEB-BUILD-REPORT.md under "Deviations". Do not silently
substitute.
```

---

## Verification (David, or a second agent)

1. Re-run the marketing, web and root checks; report red as red.
2. Local stack: apply the migration, serve the function, repeat the three
   curls. Confirm `select * from workspace_requests` shows the valid row
   and not the honeypot row, and that an anon-key select on the table is
   denied.
3. Open /signup at 375 wide next to reference-c.html's browser pages.
   Check copy strings, spacing, the three-bar progress, the disabled
   button states, the focus ring, and that the URL never leaves /signup.
4. Dashboard: approve a pending request; confirm an invite row exists, the
   join link opens the app's invite wizard on the simulator (HANDOFF.md
   checklist item 13), and the request row shows approved with the invite
   id.
5. Then push, open the PR, and after merge: apply the migration, deploy
   request-workspace, set the two marketing env vars in Vercel, redeploy
   marketing, and check https://smelterpos.com/signup returns 200 with no
   session.

## What comes later

- Multi-tenancy: an organizations table, org_id across tables and RLS,
  and the approve action provisioning a tenant instead of an invite into
  the single org. The form does not change.
- An email provider (Resend or similar) so approval emails the invite link
  automatically and the requester gets a confirmation. Until then the
  mailto: link is the send button.
- A support mailbox at support@smelterpos.com; the done page falls back to
  /support until it exists.
