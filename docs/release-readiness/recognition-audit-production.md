# Production quick-order recognition audit (issue #41)

Audit date: September 5, 2026. Branch `issue/41-recognition-audit` cut from `origin/main`
at `8f7a0a5411427f80f646e849926a219c659df42c`. Worktree:
`/Users/david/Babytuna Systems/smelter/.claude/worktrees/agent-a84a350a8bd3bfed3`.

## Scope

Issue #41 asked for a read-only run of `npm run audit:quick-order-recognition` against
production using the `sb_publishable_` key from the EAS production environment, reporting
counts and pass/fail only. No catalogue item names left this audit. No writes were made.

## Pre-flight: confirming the script performs no writes

Read `scripts/audit-quick-order-recognition.js` and
`src/__tests__/quickOrderInventoryAudit.test.ts` before running anything. The script only
spawns Jest against that one test file. The test does a single `select` (`.eq('active', true)`,
paginated `.range()`) against `inventory_items` and compares results in memory with
`matchCatalogItem`. There is no `insert`, `update`, `upsert`, `delete`, or RPC call anywhere in
the file. Confirmed no writes before running.

## Credentials used

`eas env:list --environment production` (read-only command, no export/rotation) returned the
production `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` directly (not marked sensitive). The
production `EXPO_PUBLIC_SUPABASE_URL` is marked sensitive by EAS but is already committed in
`web/SETUP.md` and `web/next.config.ts` as the tips app's Supabase project URL (same project ref
`whrohvitvmcrmedepurd`); `eas env:list --environment production --include-sensitive` confirmed it
matches. No service-role key was requested, stored, or used at any point.

## Command and result

```
RUN_QUICK_ORDER_INVENTORY_AUDIT=1 npx jest --runInBand --watchman=false quickOrderInventoryAudit --testPathIgnorePatterns=/node_modules/
```

(`--testPathIgnorePatterns=/node_modules/` is required because this worktree lives under
`.claude/worktrees/`; the repo's default Jest config ignores any path containing `/.claude/`, so
`npm run audit:quick-order-recognition` and plain `npm run test:ci` both report "No tests
found"/skip the suite from here. This is the same known gap tracked for PR #54, applied to this
one test file instead of the whole suite.)

Full output: `docs/release-readiness/logs/recognition-production.log`.

**Result: FAIL (blocked, not a recognition failure).**

- Active inventory rows visible to the query: **0**
- Items probed: **0** (exact name / lowercase / simple plural probes never ran — there was
  nothing to probe)
- Recognition passes: **0**
- Recognition failures: **0**
- Duplicate normalized name failures: **0**

The test's own safety check (`catalog.length === 0 && !usedServiceRoleKey`) tripped and threw
before any matching logic ran: *"Inventory recognition audit is blocked: no inventory rows are
visible with the public key... Zero rows cannot prove recognition."* This is the test failing
closed by design, not evidence of a bad match against any real item.

## Why this happened

`inventory_items` is RLS-protected and scoped to an authenticated, org-scoped session.
Production's anonymous/publishable key alone (matching the same pattern already documented in
this repo's earlier local runs, see `docs/release-readiness/logs/recognition-local.log`) cannot
read any rows. A prior aggregate count check on this project (see
`docs/release-readiness/report-content.json`) confirmed 240 active inventory items exist in
production, but that count came from a different, already-approved read path — it did not use
the publishable key against `inventory_items` directly, and no service-role key was granted or
used for this issue.

## Outcome

The recognition audit could not be completed against production with the publishable key as
scoped by issue #41. This is a credential/authorization gap, not a code or recognition-matcher
bug, and not a production data problem. No per-pattern recognition-failure issues were filed
because there were no visible items to test.

To actually run this audit against the full 240-item production catalogue, a follow-up needs
one of:
- An authorized server-side/service-role credential scoped for this read-only audit only, or
- A short-lived authenticated session for a real production org, obtained through normal auth
  (not by minting or exporting a service-role key into this repo or worktree).

Both options are a scope decision (issue owner call), not something this issue's worker should
decide unilaterally, so this was stopped and reported rather than escalated to broader
production access.

## Validation run alongside this audit

- `npm run typecheck`: pass, no errors.
- `npm run lint`: pass, 0 errors, 90 pre-existing warnings (none in files touched by this issue).
- `npm run test:ci`: reports "No tests found" from this worktree (same `.claude/` path gap noted
  above; not a new regression).
- `npx jest --runInBand --watchman=false --testPathIgnorePatterns=/node_modules/`: 67 suites
  passed, 1031 tests passed, 13 skipped (the 14th skip is this audit's own suite, which only
  activates on `RUN_QUICK_ORDER_INVENTORY_AUDIT=1`), 0 failed.
