# Web Sign-up Request and Manager Approval Build Report

## Overview

Implementation and desktop/mobile refinement of the public restaurant sign-up request flow at `smelterpos.com/signup` and corresponding manager review interface in `dashboard.smelterpos.com`. Built on branch `feat/web-signup-request` within an isolated worktree.

The sign-up request experience is designed for restaurant operators seeking to onboard to Smelter. It features a responsive layout: on desktop, a two-column layout pairs a prominent hero column ("Talk to an expert to get set up.", expectation timeline, support connectivity, and trust highlights) alongside a focused form card; on mobile, a clean stacked layout delivers a fast, distraction-free flow titled "Talk to an expert".

---

## Scopes Summary

### Scope A: Data Model and Edge Function (`supabase/`)
- **Migration**: `supabase/migrations/20260913120000_workspace_requests.sql`
  - Created `workspace_requests` table with fields: `full_name`, `email`, `phone`, `restaurant_name`, `city`, `website`, `primary_category`, `locations_count`, `status` (`pending`, `approved`, `declined`), `invite_id` (foreign key to `invites.id`), `reviewed_by`, `reviewed_at`, `ip_hash`, `user_agent`.
  - Created `workspace_request_rate_limits` table with `ip_hash`, `email`, and index on `(ip_hash, created_at)`.
  - Applied schema changes with `website text` column and required `city` check.
  - RLS policies restrict public access: anonymous callers cannot query tables; authenticated managers have select/update access on requests.
- **Edge Function**: `supabase/functions/request-workspace/`
  - `validator.ts`: Pure parser and validator with strict schemas for full name, email, optional US phone, restaurant name, required city, optional website URL, locations count (1 to 20), and bot honeypot detection (`hpField`, `faxNumber`).
  - `validator.test.ts`: 6 Deno unit tests verifying valid payloads, required city validation, optional website URL handling, honeypot detection, boundary checks, and email validation. All 6 tests pass.
  - `index.ts`: Anonymous endpoint (`verify_jwt = false`). Computes SHA-256 IP hash using salt `WORKSPACE_REQ_IP_SALT`. Checks sliding window rate limit (maximum 5 requests per IP per hour). Silently discards honeypot submissions with HTTP 200 `{ ok: true }` without writing to database.
- **Live Verification via curl**:
  1. Valid submission with website and required city: HTTP 200 `{"ok":true,"id":"..."}`. Row written to `workspace_requests` with status `pending`.
  2. Honeypot submission (`faxNumber: "555-0199"`): HTTP 200 `{"ok":true}`. Zero rows written to `workspace_requests` and zero rate limit records.
  3. Rate limit enforcement: 6th request from identical IP returned HTTP 429 `{"ok":false,"error":"rate_limited"}`.

### Scope B: Marketing Signup Page (`marketing/`)
- **Route**: `marketing/src/app/signup/page.tsx`
  - Metadata configured with title "Talk to an expert | smelter".
  - Full-viewport container supporting desktop two-column split and mobile stacked view.
- **Component**: `marketing/src/components/signup/SignupFlow.tsx`
  - **Top Navigation**: Fixed header with Smelter logo on the left and dashboard sign-in link. Card header has top-right sign-in button removed.
  - **Desktop Layout (Two-Column Split)**:
    - Left Column: Large headline "Talk to an expert to get set up.", numbered "What to expect" list (1. Submit this form, 2. We will reach out within 1 business day, 3. Get started using smelter immediately), "Already using smelter? Connect with Support", and trust badges.
    - Right Column: Focused card containing the 3-step form.
  - **Mobile Layout**:
    - Headline: "Talk to an expert".
    - "What to expect" expectation card right below title.
    - Clean stacked form inputs.
  - **Step 1 (Your Details)**:
    - Fields: Full name (blank placeholder), Email (blank placeholder, updated from "Work email"), Phone (optional, blank placeholder).
    - Continue button activates once name and email are valid.
  - **Step 2 (Business Name)**:
    - Title: "Business name".
    - Top-right corner: "Back" button to return to Step 1 (replaces previous sign-in position).
    - Removed profile badge (James Wong avatar) and order category chips.
    - Fields: Restaurant name (required), City (required), Website (optional link field), Locations stepper (1 to 20).
    - Submit button: "Submit Request".
  - **Step 3 (Request Received)**:
    - Green check ring (`#E6F4EA` background, `#22883E` icon; the only green element in the UI).
    - Read-only summary card displaying Restaurant name, Requester email, City, Website (if provided), and Locations count.
    - "Back to smelterpos.com" action button and link to Support.
  - **Security & Validation**:
    - Honeypot input (`faxNumber`) hidden offscreen with `tabIndex={-1}` and `aria-hidden`.
    - Rate limit banner (HTTP 429) rendered with alert styling.
- **API Proxy Route**: `marketing/src/app/api/signup/route.ts`
  - Next.js server route forwarding JSON payload directly to the `request-workspace` edge function.

### Scope C: Dashboard Approval UI (`web/`)
- **Review Tab**: `web/src/components/manager/dashboard/WorkspaceRequestsPage.tsx`
  - Filter tabs (`Pending`, `Approved`, `Declined`, `All`) with active pending count badge.
  - Request cards render restaurant name, city badge, website external link (if present), locations count, requester contact information, and relative submission timestamp.
  - Actions:
    - **Approve**: Provisions manager invite, updates status to `approved`, and reveals join URL.
    - **Decline**: Prompts confirmation and updates status to `declined`.
    - **Share Invite**: One-click clipboard copy button and prefilled `mailto:` link.
- **Navigation & Database Types**:
  - `web/src/types/database.ts`: Added `website: string | null` to table row, insert, and update definitions.
  - `web/src/components/manager/dashboard/types.ts`: Added `requests` to `NavId`.
  - `web/src/components/manager/dashboard/Sidebar.tsx`: Added Workspace Requests navigation item.

---

## Verification Results

### Marketing Workspace (`marketing/`)
```bash
npm run typecheck  # Passed: Next.js typegen and tsc --noEmit (0 errors)
npm run lint       # Passed: eslint (0 errors, 0 warnings)
npm run build      # Passed: Next.js production build succeeded
```

### Web Workspace (`web/`)
```bash
npm run typecheck  # Passed: Next.js typegen and tsc --noEmit (0 errors)
npm run lint       # Passed: eslint (0 errors, 0 warnings)
npm test           # Passed: 25 test files passed, 280 tests passed, 8 skipped
npm run build      # Passed: Next.js production build succeeded
```

### Root Workspace (`/`)
```bash
npm run typecheck  # Passed: tsc --noEmit (0 errors)
npm run lint       # Passed: eslint . --max-warnings 0 (0 errors, 0 warnings)
```

### Edge Function Unit Tests (`supabase/functions/request-workspace/`)
```bash
deno test validator.test.ts  # Passed: 6 passed, 0 failed
```

---

## Visual Captures

All 10 updated captures are saved in `docs/mockups/auth-redesign-2026-09/web-captures/`:

- `01-account-1280.png`: Desktop Step 1 with two-column hero layout and clean details card.
- `01-account-375.png`: Mobile Step 1 with "Talk to an expert" and expectation summary.
- `02-restaurant-1280.png`: Desktop Step 2 with "Business name", top-right Back button, required city, and website link input.
- `02-restaurant-375.png`: Mobile Step 2 with "Business name", top-right Back button, required city, and website link input.
- `03-done-1280.png`: Desktop Step 3 confirmation with green check ring and summary details.
- `03-done-375.png`: Mobile Step 3 confirmation with green check ring and summary details.
- `04-validation-error-1280.png`: Desktop inline validation errors on empty required fields.
- `04-validation-error-375.png`: Mobile inline validation errors on empty required fields.
- `05-rate-limit-1280.png`: Desktop HTTP 429 rate limit alert banner.
- `05-rate-limit-375.png`: Mobile HTTP 429 rate limit alert banner.
