# Studio 2.4 verification report

Independent verification of `feat/ui-studio-2.4` (Codex build, `bd846d7`) against
`reference-glide.html` and `SPEC.md`. Verified Sep 13 2026 by Claude on the Release QA
simulator `EF05F833-2AC4-4383-8688-36C51B956BCF` (iPhone 17 Pro Max, iOS 26.2, 440 x 956 pt)
from a native build of the worktree (`npx expo run:ios --device "$(scripts/sim.sh udid)" --port 8091`,
Build Succeeded), JavaScript served by Metro on 8091 from this worktree. The reference page was
opened in a browser and driven to the same states. Captures are in `verify-captures/`. Nothing in
`BUILD-REPORT.md` was taken on trust; every row below was read in code and looked at on the
device.

Local backend: the isolated `ui-studio-2.4` Supabase stack on 54521 with the E2E fixture
accounts (`E2E Manager`, `Fixture Sushi`). Fixture data is small (5 to 7 checklist rows, one
supplier), so counts differ from the reference's seed data by design.

## Checks

| Check | Before fixes | After fixes (final tree `daee98c`) |
|---|---|---|
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run lint` | exit 0, no warnings | exit 0, no warnings |
| `npm run test:ci` | 99 suites passed, 1 skipped; 1322 tests passed, 1 skipped | 99 suites passed, 1 skipped; 1322 tests passed, 1 skipped |

No `no-design-drift` suppressions were added. New tokens: `tracking.tag` and `color.onInkMuted`
in `src/theme/tokens.ts`.

## Acceptance checklist (SPEC section 10)

| # | Item | Matches reference | Drift found (file:line, expected vs actual) | Fixed |
|---|---|---|---|---|
| 1 | Order tab at launch: header, category strip, Compact rows, add bar, dock with `…`, badge hidden, send disabled | Yes after fixes. Measured on device: title at 66 (status area + 4), strip pills 30 tall with 7 x 12 padding, compact check box 30 and stepper 30, row pitch 50, add bar bottom edge 104 above the screen bottom, dock 80 tall with 12 bottom inset and 6 inner padding, `…` segment 64 wide. Send button disabled fill and no badge at zero. Capture `01-order.png`. | `SimpleOrderScreen.tsx:881-887` category strip gap 8 and content inset 16; reference `.catstrip` gap 6, inset 20. `SimpleOrderScreen.tsx:921` selected pill count was pure white; reference `rgba(255,255,255,.6)`. `PinnedOrderBar.tsx:330` search input auto-capitalised the query (`al` rendered as `Al`). | Yes: `dd10e43` |
| 2 | Check three items: boxes fill accent with the pop, quantities turn ink, badge shows 3 with the pop, send enabled, counts update | Yes. Counts `2/2`, `1/2`, header `5 items · 3 selected`, badge 3, send accent. Motion read in `ChecklistItemRow.tsx:160-176`: fill 280ms glide ease, check scale 320ms pop, control colour 280ms; badge `withSequence` 1 to 1.35 to 1 over 320ms pop in `PinnedOrderBar.tsx:107-110`. Capture `02-selected.png`. | None | n/a |
| 3 | Plus on an unchecked row checks it and steps 0.5 for `case` items | Yes. Beef Meatballs (case) went 1 to 1.5 and checked; `1/1`. Capture `03-half-step.png`. | None | n/a |
| 4 | Type `al`: results card with 6 hits; add Aluminum Foil under Packaging, checked, toast, query cleared | Yes. Six substring hits, `· on your list` suffix and green check on listed items, Packaging section created, row checked, toast `Aluminum Foil added` 200 above the bottom, query cleared. Captures `04-search-results.png`, `04-added-item.png`. | Query casing (see item 1). | Yes: `dd10e43` |
| 5 | Send opens Review order (straight slide), drag up expands to 88%, drag down collapses then closes, send, success, Done clears | Yes. Header measured at y 590 at rest, 137 after the upward drag (sheet top 115 = 12% of 956, so 88% height), 590 after the downward drag, gone after the second; selection kept through the gestures. Sheet open is 320ms with the contract bezier and 240ms scrim (`BottomSheetShell.tsx:45-46`), no overshoot. Success screen: 88 goodBg ring with 44 check, `Order sent` 22/700, body 14 ink2, hugging `Done`; Done left `7 items · 0 selected`. Captures `05-review.png`, `05-expanded.png`, `05-collapsed.png`, `05-dismissed.png`, `05-success.png`, `05-done-cleared.png`. | `ConfirmOrderSheet.tsx:91` item names 600; reference `.kv span` is regular weight. `ConfirmOrderSheet.tsx:142` `Add`/`Edit` was 13pt; reference `.lab .n` is 11/600. | Yes: `efc7663` |
| 6 | History row opens the detail sheet with items and Show/Hide; Reorder tag loads the lines and toasts | Yes. Detail sheet: date title, `{supplier} · sent {time}`, three stat tiles, Items card, `Message as sent` with Show/Hide, `Reorder these 3 items`. Reorder tag switched to Order with 3 selected and toasted `Loaded 3 items from Today`. Captures `06-history.png`, `06-detail.png`, `06-detail-message.png`, `06-reordered.png`. | `HistoryScreen.tsx:56` `{n} sent` count had no weight (reference 11/600). `HistoryScreen.tsx:49-50` Reorder tag padding 9 x 5, no tracking; reference `.tag` 4 x 8 with .04em. `HistoryScreen.tsx:59-60` empty state padding 28 and 24 glyph; reference 34 x 24, gap 6, 28 glyph. `OrderDetailSheet.tsx:30,37` Items count and Show/Hide had no weight; reference 600. | Yes: `ef9f0cc`, `f2e8016` |
| 7 | Tab tap: indicator glides 320ms with no stretch, pages crossfade with the 10pt lift, add bar drops leaving Order, `…` collapses | Yes on the endpoints; the still captures cannot resolve the 320ms glide. Read in code: `TabBar.tsx:83-87,91` indicator 320ms ease-out-cubic, 380ms tracking, `…` width 0 to 64 over 340ms, label 260ms; `GlidePage.tsx:25-26` outgoing 180ms opacity and -6, incoming 300ms opacity and 340ms 10 to 0; `PinnedOrderBar.tsx:88-93` add bar 28 drop over 260ms and 220ms fade. Capture `07-tabs.png`. | None | n/a |
| 8 | Drag the indicator across the dock; release over History selects it | Yes. Low-level drag from the Order tab to History: indicator followed the finger (`08-dock-drag-mid.png`), release selected History (`08-dock-drag.png`). Threshold 6pt in `TabBar.tsx:88,414`. | None | n/a |
| 9 | Settings: no Stock check row; Order reminders and Checklist display open sheets; Profile pushes and back returns to Settings; lockup footer present | Yes. Rows: profile card, Ordering (reminders, display), Help (support, About v2.3), Manager (this account is a manager), Sign out, footer with the 22pt lockup and `Smelter 2.3 (21) · Signed in as E2E Manager`. No Stock check, Cart, Advanced or Display and Accessibility rows. Profile pushed from the right and `Back to settings` returned to Settings. Captures `09-settings.png`, `09-reminders.png`, `09-profile.png`, `09-settings-footer.png`. | `Segment.tsx:81` selected option was accent; reference `.seg span.on` is ink with white text (affects the PIN/Password segment and Works at). `LocationPill.tsx:25-26` radio ring 1.5 `disabled` and cards had 12 gap; reference `.rd` 2pt `hairS` and 10 gap. | Yes: `369f35d`, `f1d1d30` |
| 10 | Checklist display: three densities match 2.1; categories off gives one flat section | Yes. Comfortable: one white card per row, 36 box, 34 steppers, 19 quantity, 1.5 accent ring when checked. Dense: 26 box and steppers, no meta line, 40 min row, label padding 10/2. Categories off: single `All items 3/7` section. Values read in `ChecklistItemRow.tsx:46-93` match the 2.1 table exactly (dense stepper gap 2, as the reference). Captures `10-display.png`, `10-comfort.png`, `10-dense.png`, `10-flat.png`. | None | n/a |
| 11 | Switch to Manager view: fade under 0.5s, toast gone by 1.3s. Home, Fulfillment (badge), History, Settings match 2.4 to 2.7 | Screens yes; the switch has an intermittent defect (see Open defects). Timed captures of the switch: 0.15s old screen visible, 0.4s faded, 1.0s new tab set with the `Employee view` toast, 1.8s toast gone (`11-switch-t015.png` to `11-switch-t180.png`). `switchViewMode.ts:13-21` fades 200ms and toasts 1300ms. Home: hero card with warning tag, three well stat tiles, `Review orders ›`, Quick actions rows, Suggestions empty state; no Quick Order, search or wordmark. Fulfillment: notes, suppliers with 38 avatar, `Send all · 1 supplier`, Order later, dock badge. History: chip row, supplier rows with `SENT` tag. Settings: Team, Ordering, Help, Employee groups. Captures `11-manager-home.png`, `11-fulfillment.png`, `11-manager-history.png`, `13-manager-settings.png`. | `HomeScreenView.tsx:389-396` `{n} waiting` tag and `StatusPill.tsx:55-63` were sentence case with caption tracking; reference `.tag` is uppercase with .04em. `fulfillment-history.tsx:50` chips 7 x 12; reference `.chips span` 8 x 13. | Yes: `5ed40de`, `a1275d2` |
| 12 | Supplier row pushes the review screen; Share pops and toasts | Push yes; toast was missing. Review screen: back circle, supplier title, `Ready` tag, three stat tiles, Items with Auto-fill, compact rows with steppers, Message preview with Format, Copy and Share footer, dock still visible. Share opened the native share sheet, finalized, and returned to Fulfillment with the queue drained. Captures `12-supplier-review.png`, `12-share-popup.png`, `12-shared.png`. | `fulfillment-confirmation.tsx:2681-2690` no `Sent to {supplier}` toast after Share and no `Copied` toast after Copy (SPEC 7.3, 8, reference `sharesent` and `copy`). | Yes: `3591dbb` (toast after a successful finalize) |
| 13 | Manager Settings has no Display and Accessibility, Notifications, Quick Search or Quick Order rows; footer lockup present | Yes. Rows read from the accessibility tree: Team, Access codes, Supplier contacts, User management, Inventory, Export format, Order reminders, Checklist display, Contact support, About and legal, Switch to Employee view, Sign out, then the 22pt lockup and version line. Capture `13-manager-footer.png`. | None | n/a |
| 14 | `ordering_advanced` and `stock_check` off in a fresh account and absent from every manager toggle surface | Yes. Member detail Features: `Checklist ordering`, `Tips` only. New employee defaults and Invite `What they can use`: the same two. User management hides both keys (`user-management.tsx:66-69`). Defaults off in `moduleStore.helpers.ts:47-48` and `employeeDefaults.ts:26-27`; migration `20260912235714_ui_studio_hidden_module_defaults.sql` present, applied only locally. Captures `14-modules.png`, `14-invite.png`, `14-defaults.png`, `14-user-management.png`. | `Segment.tsx:81` Works at segment selected fill accent (see item 9). | Yes: `369f35d` |
| 15 | Three checks green with the new tokens and no suppressions | Yes, see Checks. | None | n/a |

## Drift left as is

| Where | Expected vs actual | Why not fixed |
|---|---|---|
| `TabBar` Fulfillment glyph (`app/(manager)/_layout.tsx:28`) | Reference `clipcheck` (clipboard with a check); actual `clipboard-outline`, no check | Ionicons has no clipboard-check glyph; `TabBarItem.icon` only accepts Ionicons names. Adding an SVG path option to the dock is a primitive change beyond a drift fix. |
| Team feature switches (`TeamUI.tsx:84`) | Reference 44 x 26 custom switch, 20 knob; actual native iOS `Switch` (51 x 31) | Would need a shared switch primitive; the Checklist display sheet already has the 44 x 26 control inline, so this is a consolidation task. |
| Sheet body upward drag (`BottomSheetShell.tsx:318-356`) | Reference: an upward drag on a body scrolled to the top expands; actual: only the handle and header expand, the body scrolls | Declared by Codex; native ScrollView owns upward body gestures. Header and handle expansion verified. |
| Pushed screen parallax (`GlidePage.tsx:41`) | Reference moves the screen behind to -24% and dims it | Declared by Codex; the tab navigator does not expose the screen behind. Slide, left shadow and edge swipe are implemented. |
| Privacy choices (`EmployeeProfileScreen.tsx:218`) | Reference pushes a screen (chevron-right); actual opens a sheet (chevron-down) | Declared by Codex; the existing functional sheet was kept. |
| Order detail kv hairline (`OrderDetailSheet.tsx:31`) | Reference hairline spans the card; actual inset 14 both sides | Cosmetic, inside a card at 14 margin; left alone to keep the diff small. |
| Reorder toast copy | Reference lowercases the date (`from yesterday`); actual `from Today` | SPEC 8 says `Loaded {n} items from {date}`; the app follows the written contract. |

## Open defects found during verification

**Employee tab set can arrive blank after a Manager to Employee switch.** Three times out of
about eight, switching from Manager view to Employee view after visiting Team and a member
detail left the Order tab as a bare page-coloured screen with only the dock (the `…` segment
present, so the navigator was on `simple-order`). Tapping History and then Order restored the
screen. Captures `11-switch-t100.png`, `11-switch-t180.png` and `11-switch-cold-result.png`
show the blank state; `11-switch-cold-result.png` was taken after a cold launch into Manager
view, Settings, Team, member, back, back, Switch to Employee view. Instrumented runs that
passed showed the route guard settling to `isChecking:false`, the GlidePage opacity animation
finishing, and the Order screen laying out at 440 x 956; the failing runs I could instrument
showed the same guard and animation states, so the cause was not established and no fix was
made. Reproduction is timing dependent. Suggested next step: log `SimpleOrderScreen` layout and
the bottom-tab scene visibility in the failing state.

## Not verifiable on the simulator

- Frame-accurate durations (320ms glide, 280ms push, 260ms add-bar drop, 420ms success ring).
  Screenshot latency through `simctl io` is around 150ms, so timing was verified in code and
  captures establish endpoints only.
- `…` segment width animation and the `pop` overshoot curves, for the same reason.
- Edge-swipe back on pushed screens (28pt start, 110pt release): AXe drags from x < 28 were
  not attempted because the simulator maps edge starts to system gestures.
- `Copied` toast: not exercised, since Copy also finalizes and drains the supplier queue; the
  code path mirrors Share.
- Send all: not pressed (single supplier in the fixture, and it drains the queue).
- Reminder save: the sheet was opened and inspected, `Set reminder` was not pressed (writes a
  reminder rule to the local stack).
- Sign out and Delete account flows.
- Fresh-account module defaults: verified in code and by Codex's SQL fixture, not by creating a
  new account on the local stack.

## Environment notes

- The app was signed out once mid-session by input that did not come from this session; the
  peer Claude session on this Mac confirmed it was not driving the device. A Codex desktop helper
  was running at the time. Re-signed in with the fixture manager and continued; no capture in
  this report was taken while that interference was visible.
- Metro's file watcher does not see edits inside this worktree (watchman's root is the main
  checkout and `.claude/` is ignored), so Metro was restarted after each batch of edits and the
  app relaunched with `-RCT_jsLocation localhost:8091`.
- Native modal contents only appear in the AXe accessibility dump after a fresh launch; sheet
  positions were measured from the dump when available and from pixels otherwise.
- The native build rewrote `ios/Babytuna.xcodeproj/project.pbxproj` with a local signing team;
  that change was reverted and is not committed.

## Fix commits (this branch, on top of `bd846d7`)

| Commit | Spec section | Change |
|---|---|---|
| `37f40c8` | 1 | `tracking.tag` and `color.onInkMuted` tokens |
| `dd10e43` | 2.1 | Category strip 6 gap and 20 inset, muted count on the selected pill, search input no auto-capitalise |
| `efc7663` | 6.1 | Review order names regular weight, `Add`/`Edit` 11/600 |
| `f2e8016` | 6.2 | Order detail Items count and Show/Hide 600 |
| `ef9f0cc` | 2.2 | `{n} sent` 600, Reorder tag 4 x 8 with tag tracking, empty state 34 x 24 / gap 6 / 28 glyph |
| `5ed40de` | 2.4, 7.3 | Status tags uppercase with tag tracking (Home hero tag, StatusPill) |
| `a1275d2` | 2.6 | Manager history chips 8 x 13 |
| `3591dbb` | 7.3, 8 | `Sent to {supplier}` after Share, `Copied` after Copy |
| `369f35d` | 7.2, 6.9 | Segment selected option ink |
| `f1d1d30` | 6.8 | Location sheet radio cards 10 gap, 2pt hairlineStrong ring |
| `daee98c` | 7.2 | Receive delivery pushes from the right, back returns to Order |
