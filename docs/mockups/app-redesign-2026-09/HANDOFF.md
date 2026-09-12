# Handoff: Studio UI (Glide) for Smelter 2.4

Two prompts. The first goes to Codex to build. The second goes to a Claude
agent afterwards to verify the build against the reference and fix drift.
Both point at the same two files in this folder:

- `reference-glide.html` — the approved interactive reference (open in a
  browser; also published at the artifact link David has).
- `SPEC.md` — the written contract with every number, copy string and
  behaviour, plus the acceptance checklist in section 10.

`index.html` in the same folder is the earlier three-way motion comparison.
Ignore it for building.

---

## Prompt 1: Codex build

```
You are implementing the approved Smelter 2.4 UI in the Expo Router React
Native app at /Users/david/Babytuna Systems/smelter. Read these first, in
order, before touching code:

1. AGENTS.md (simulator rules, build gotchas, validation commands)
2. docs/mockups/app-redesign-2026-09/SPEC.md (the contract)
3. docs/mockups/app-redesign-2026-09/reference-glide.html (open it; every
   control on the phone works, use it to settle any question the spec leaves)
4. src/theme/tokens.ts and eslint-rules/ (smelter/no-design-drift)

Design: "Studio" direction, "Glide" motion, Compact checklist density by
default. Build exactly what the reference shows. Do not invent screens,
copy, colours or motion that are not in the spec or the reference. Where
the spec and the reference disagree, the reference wins; note it in the PR.

Branch and worktree:
- Create branch feat/ui-studio-2.4 from integration/app-store-2.3 (if that
  branch has already merged to main, branch from main instead) in a
  worktree under .claude/worktrees/ui-studio-2.4. Never work in the main
  checkout.
- Commit early and often. Do not push, do not open a PR; David does that.

Scope, in this order. Each step ends with typecheck, lint and tests green.

A. Tokens and primitives
   - Update src/theme/tokens.ts to SPEC section 1 (page, well, hairline,
     scrim, dockBg, dockFg, sheetBg, radii 22/14/30, the three shadows,
     motion tokens ease/dur/pop). Keep names stable where they exist.
   - Card: no border, no shadow. ListRow: SPEC 2.3 row anatomy.
   - Sheet + BottomSheetShell (src/components/ui/Sheet.tsx,
     src/components/BottomSheetShell.tsx): SPEC section 5. Straight
     slide 320ms cubic-bezier(.2,.8,.2,1), scrim 240ms, drag rules,
     expandable prop with the 88% detent, X in the header. BottomSheetShell
     must read tokens.ts, not design.ts.
   - TabBar (src/components/ui/TabBar.tsx): SPEC section 3. Ink dock,
     80 tall, bottom 12, single sliding accent indicator measured from
     the active tab (Reanimated withTiming 320ms ease-out-cubic, tracking
     the target for 380ms total), animated 0 to 64 more segment, drag
     to select with the 6pt threshold. Update getTabBarClearance to
     104 / 190 / 120 as the spec states. Delete
     src/components/navigation/FloatingPillTabBar.tsx and route its one
     helper caller to TabBar.

B. Employee surfaces
   - Order: src/features/simpleOrder/SimpleOrderScreen.tsx,
     components/ChecklistItemRow.tsx, PinnedOrderBar.tsx, the seven
     sheets. SPEC 2.1 and 6.x. Header "Order" with count subtitle and the
     location pill, category jump strip, three densities (the existing
     comfort/dense setting becomes comfort/compact/dense with compact the
     default), round send button, results card, success screen.
   - History: src/features/simpleOrder/HistoryScreen.tsx, SPEC 2.2 and 6.2
     (items list plus Show/Hide message, not the raw text block).
   - Settings: src/features/employeeSettings/EmployeeSettingsScreen.tsx,
     SPEC 2.3. Remove the Stock settings row. Add the brand footer using
     assets/images/smelter-lockup.png at 22pt high, shipped as delivered.
   - Profile: EmployeeProfileScreen back must land on Settings. Add
     backBehavior="history" to the Tabs in app/(tabs)/_layout.tsx or
     replace to /(tabs)/settings; prove it with a cold launch.
   - Page change: SPEC section 4, implemented in the tabs layout so every
     tab gets it.

C. Manager surfaces (SPEC 2.4 to 2.7, 7.2, 7.3)
   - app/(manager)/_layout.tsx renders the shared TabBar (adapter like
     EmployeeTabBar) with Home, Fulfillment (badge), History, Settings.
     Remove getTabBarScreenOptions and TabButton usage.
   - Home (src/features/home/HomeScreenView.tsx manager mode): the
     Fulfillment hero, three quick actions, Suggestions empty state.
     Remove search card, browse preview, reminder banner, Quick Order
     row. Drop GlassSurface, glassColors, ManagerScaleContainer.
   - Fulfillment (app/(manager)/fulfillment.tsx): header per spec, notes
     card, supplier rows, Send all button, Order later card. Replace
     FulfillmentHeader, glassTabBarHeight padding, and ManagerScaleContainer.
   - Manager Settings (app/(manager)/profile.tsx + settingsSections.ts):
     the groups in SPEC 2.7 only. Rows push with origin/backTo as today.
   - History tab = fulfillment-history with the chip row; detail opens
     the 6.2 sheet instead of a pushed screen.
   - Supplier review (fulfillment-confirmation.tsx): header, tiles, note,
     compact rows, message preview, Copy/Share footer. Replace the
     Alert-based instructions with the sheet pattern.
   - Every manager screen in scope stops importing @/theme/design,
     GlassSurface, StackScreenHeader and ManagerScaleContainer.

D. Module gating (SPEC section 9)
   - New migration: get_effective_modules defaults set ordering_advanced
     and stock_check to false for employees and managers; update
     src/store/moduleStore.helpers.ts getRoleDefaultModules to mirror it
     (its comment says they MUST match). Update the
     employee_invite_module_defaults built-ins in
     src/services/employeeDefaults.ts.
   - Remove ordering_advanced and stock_check from every manager toggle
     surface: team/MemberDetailScreen, team/DefaultsScreen,
     team/InviteScreen, manager-settings/user-management Modules card,
     MODULE_LABELS consumers. Keep the keys, guards and routes.
   - Employee tabs come from getVisibleEmployeeTabs; confirm Advanced and
     Cart never render and update src/__tests__/moduleAccess.test.ts and
     employeeChecklistMeta.test.ts accordingly.

Validation (report exact commands and honest output in the final message
and in docs/mockups/app-redesign-2026-09/BUILD-REPORT.md):
- npm run typecheck
- npm run lint
- npm run test:ci
- Simulator: scripts/sim.sh assert, then
  npx expo run:ios --device "$(scripts/sim.sh udid)" with Metro on port
  8091 (npx expo start --port 8091). Walk SPEC section 10 items 1 to 14
  and save a screenshot per item under
  docs/mockups/app-redesign-2026-09/build-captures/ using
  scripts/sim.sh io screenshot. Name them 01-order.png ... 14-modules.png.

Known traps:
- The repo path has a space. expo run:ios needs the quoting patches
  described in AGENTS.md; two live in node_modules and vanish after
  npm install.
- Never pass "booted" to simctl. Use scripts/sim.sh only. Do not touch
  UDID 7C0CA22A-4895-44BA-BF7E-F53BB5CAF7F8.
- 73 files still import the deprecated @/theme/design. Only migrate the
  screens in scope; do not start a repo-wide sweep.
- Two history screens exist (simpleOrder/HistoryScreen and
  app/orders/history.tsx) and two profile screens ((tabs)/profile and
  settings/profile). The employee tab uses simpleOrder/HistoryScreen and
  (tabs)/profile. Leave the others alone.
- The brand rule: the lockup ships exactly as delivered, no recolour, no
  container. Only the height is set.
- Status colours (good, warning, alert) never colour a button, chip or
  title.
- No em dashes in user-facing copy, commit messages or the report.

If something in the spec cannot be built as described (a Reanimated
limitation, a navigation constraint), build the closest thing, keep the
timing and easing, and list every deviation in BUILD-REPORT.md under
"Deviations". Do not silently substitute.
```

---

## Prompt 2: Claude verification and fix

```
You are verifying Codex's implementation of the Smelter 2.4 Studio UI in
the worktree at .claude/worktrees/ui-studio-2.4 (branch
feat/ui-studio-2.4) of /Users/david/Babytuna Systems/smelter.

The reference is docs/mockups/app-redesign-2026-09/reference-glide.html
(open it in the Browser pane; every control works) and the contract is
docs/mockups/app-redesign-2026-09/SPEC.md. Codex's own report is
docs/mockups/app-redesign-2026-09/BUILD-REPORT.md with screenshots under
build-captures/.

Do this in order:

1. Read AGENTS.md, SPEC.md and BUILD-REPORT.md. Note every deviation
   Codex declared.
2. Re-run the checks yourself: npm run typecheck, npm run lint,
   npm run test:ci. Report red as red.
3. Build and launch on the Release QA simulator by UDID
   (scripts/sim.sh assert; npx expo run:ios --device "$(scripts/sim.sh
   udid)"; Metro on 8091). Walk SPEC section 10 items 1 to 14 yourself.
   For each item take your own screenshot with scripts/sim.sh io
   screenshot and open the reference page to the same state side by side.
4. Compare against the spec numerically where you can: read the
   rendered styles in code (tokens.ts values, TabBar geometry, Sheet
   easing and durations, densities in ChecklistItemRow) and against the
   screenshot visually (spacing, radii, colours, copy strings, glyphs,
   which rows exist, which control opens a sheet vs pushes).
5. Write docs/mockups/app-redesign-2026-09/VERIFY-REPORT.md: a table with
   one row per checklist item, columns Item / Matches reference / Drift
   found (file:line, what differs, expected vs actual) / Fixed. Include
   a "Not verifiable on simulator" section for anything you could not
   exercise and say why.
6. Fix every drift you found in the worktree, smallest change first,
   re-run the three checks and re-capture the affected screenshot.
   Commit each fix separately with a message naming the spec section.
   Do not widen scope beyond the drift list; do not refactor.
7. Final message: done / remaining / what David should look at on the
   simulator, and the exact commands you ran with their results.

Rules: review reads code and screenshots, it does not trust
BUILD-REPORT.md claims. Never pass "booted" to simctl. Do not touch UDID
7C0CA22A-4895-44BA-BF7E-F53BB5CAF7F8. Do not push, do not open a PR.
```

---

## What David does between the two prompts

1. Run Prompt 1 in Codex (Sol, xhigh). Codex cannot push or use gh; the
   commits stay in the worktree.
2. Run Prompt 2 in a Claude session (Opus or Fable).
3. Read VERIFY-REPORT.md, then push and open the PR yourself.
