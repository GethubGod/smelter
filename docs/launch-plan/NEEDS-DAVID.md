# NEEDS-DAVID (App Store 2.3, updated 2026-09-10 by the orchestrator)

Items only David can decide or run. Each has a recommended default.

## #47 production build, TestFlight, device session
- Prepared, not run: docs/release/production-build.md (eas build and eas submit commands, archive checks) and docs/release/device-session.md (tap-by-tap script) are written by the #49 verifier. David runs the EAS production build and submit.

## The 27 CONFIRM items for App Store Connect
- docs/release/app-store-connect.md, section "Every CONFIRM in one list". #47 depends on them.

## #41 recognition audit
- No production manager credential exists in repo fixtures, `eas env:list --environment production` (only EXPO_PUBLIC_SUPABASE_URL, _ANON_KEY, _PUBLISHABLE_KEY), or the gitignored .env (URL and anon key only).
- The audit test (src/__tests__/quickOrderInventoryAudit.test.ts) accepts only a publishable key (sees zero rows under RLS) or SUPABASE_SERVICE_ROLE_KEY (forbidden by decision).
- Needs: a manager sign-in path in the audit (email + password env) and a production manager credential from David. Issue stays open.

## Branch cleanup candidates (list only, never deleted)
Merged issue/* branches (PR merged): issue/39-e2e-unexercised-routes (#64), issue/40-e2e-mutations (#71), issue/41-recognition-audit (#66), issue/42-delete-cap-tests (#51), issue/43-lint-warnings-zero (#55), issue/44-npm-audit-mitigations (#56), issue/45-push-token-ownership (#52), issue/48-app-store-metadata (#53), issue/57-agents-sim-udid (#58), issue/60-send-all-params (#68), issue/63-local-service-role-grants (#65), issue/69-stock-count-persistence (#72). That is 12 (the audit said 13; main is the 13th merged ref).
Merged worktree-agent-* branches (no PR, fully contained in origin/main): a150b1288d97dfe69, a38bd304d03312798, a435d3a57e1a702d9, a47d23a5e5a33db74, a6631a0d491399755, a6f435030f056b4a5, a76e7e61d2b3beef8, a7a8ff6087fa45247, a7dd68c5aa431b847, a84a350a8bd3bfed3, a9d910f9e9e877e1d, aaf060bbad27fa15a, acddc5b5f05ece8cc (13).
Excluded: this session's worker branches (worktree-agent-a283a281d875b650e, a2d2d2da61d897b8d, a892664a2b6ae35c2, ade16153dd8754d14), issue/32-ui-primitives (#54 open), perf/ten-high-impact-improvements (#75 open), integration/app-store-2.3.
Command per branch: git branch -d <name> (falls back to -D only for squash-merged ones after confirming the PR shows merged).

## 27 CONFIRM items
docs/release/app-store-connect.md, section "Every CONFIRM in one list" (line 473).

## Stock RPCs and suspended accounts (from Sol's #76 review)
- startOrResumeStockCheck, recordStockCheckCount and completeStockCheck are SECURITY DEFINER and check only for an authenticated owner, not profiles.is_suspended (supabase/migrations/20260812170000_stock_check_v2.sql). The app side is fixed in #76 (suspended sessions no longer trigger the queue drain), but a suspended account with a valid JWT could still call the RPCs directly.
- Recommended default: a follow-up migration that raises when the caller's profile is suspended, after 2.3 ships. Not done in this milestone because migrations need David's go.

## #67 local baseline grants
- Deferred past 2.3 by decision. Issue stays open.
