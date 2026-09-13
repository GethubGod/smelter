# Smelter 2.4 UI: Studio design, Glide motion

Approved by David on Sep 12 2026. This document is the written contract for the
interactive reference at `reference-glide.html` in this folder. When the two
disagree, the HTML wins; file the discrepancy against this document.

Scope: every employee root screen, every manager root screen, all sheets and
pushed screens reachable from them, the tab bar, and the module gating that
hides Advanced, Cart and Stock check. Auth screens are out of scope and stay
black as today.

All values are iOS points. Every value maps to `src/theme/tokens.ts`; where a
value is new, the section says so and the token must be added there, not
written inline (ESLint `smelter/no-design-drift`).

---

## 1. Tokens

| Token | Value | Notes |
|---|---|---|
| page | `#F3F3F1` | new. Replaces `#F5F5F4` on daily-work surfaces |
| card | `#FFFFFF` | |
| well | `#EAEAE8` | new. Replaces `#EDEDEC` |
| hairline | `rgba(0,0,0,0.05)` | new value |
| hairlineStrong | `rgba(0,0,0,0.14)` | |
| accent | `#E84D38` | unchanged, the only action colour |
| tint | `#FBEAE7` | |
| ink / ink2 / ink3 | `#1A1A1A` / `#5F5F5F` / `#9C9890` | |
| disabled | `#C9C5BC` | |
| alert | `#C03520` | |
| good / goodBg | `#22883E` / `#E6F4EA` | status only |
| warning / warningBg | `#B45309` / `#FFF4DC` | status only |
| scrim | `rgba(20,18,14,0.5)` | sheets. Replaces 30% black |
| dockBg | `#1A1A1A` | new. The tab bar is ink |
| dockFg | `rgba(255,255,255,0.62)` | inactive tab glyph |
| sheetBg | `#F3F3F1` | sheets are page-coloured, cards inside are white |

Radii: card 22, control 14, sheet 30, pill 999. (Contract today: 16 / 12 / 24.
These change.) Card borders are gone; cards are flat white on page with no
border and no shadow.

Type: system font. display 30 / 700 / tracking -0.9. title 20 / 700 / -0.2.
body 15 / 600 (item names 16 / 600 in Comfortable, 15 in Compact, 14 in Dense).
secondary 13 / 400 (ink2). caption 11 / 700 / uppercase / tracking 0.08em (ink3).
Tab label 11 / 600. Only weights 400, 600, 700.

Shadows, exactly three: tab bar `0 10 28 rgba(20,18,14,.16)`, add bar
`0 14 34 rgba(20,18,14,.16)`, sheet `0 -10 30 rgba(0,0,0,.12)`. Search results
card also uses the add-bar shadow at 0.12. Nothing else casts a shadow.

Motion tokens: `ease = cubic-bezier(.2,.8,.2,1)`, `dur = 280ms`,
`pop = cubic-bezier(.34,1.5,.64,1)` (used only by the check mark, the badge and
the success ring). No other spring or overshoot anywhere.

---

## 2. Frame and root screens

- Status bar area 54. Root screen header starts at 58 (54 + 4).
- Header: `hrow` = title block left, location pill right, 20 side padding.
  Title 30/700. Optional subtitle 13 ink2 directly under the title, 4 gap.
- Location pill: white pill, 8×12 padding, 8pt accent dot, name 13/600,
  chevron-down 15pt ink3. Tapping opens the Location sheet (section 6).
  Present on Order, Past orders, Home, Fulfillment, manager Past orders.
  Not on either Settings screen; Settings shows a role tag (`Employee` well
  tag, `Manager` tint tag) in that slot instead.
- Body scroll padding: 16 sides, 2 top. Bottom clearance 190 on Order (add bar
  plus dock), 120 elsewhere.
- Section label (`lab`): caption style, 14 top / 4 bottom padding, count on the
  right in 11/600 sentence case (`0/11`).

### 2.1 Order (employee root, tab 1)

Header: title `Order`, subtitle `{N} items · {n} selected`, location pill.
Under it the category strip: horizontally scrolling pills, 7×12 padding, white,
13/600 ink2, count suffix in ink3; the selected pill is ink with white text.
First pill `All {N}`; then one per non-empty category using the first word
(`Fish 11`, `Produce 3`, `Dry 2`). Tapping scrolls the list to that section
label and selects the pill. Strip is 2 top / 6 bottom padding and bleeds to the
screen edges.

List: category sections in `KNOWN_ITEM_CATEGORIES` order (`displaySections.ts`),
each a section label then a group. Three densities, set in Checklist display:

| | Comfortable | Compact (default) | Dense |
|---|---|---|---|
| Group | none; each row is its own white card, radius 22, 12 padding, 8 gap | one white card per section, radius 22, 2×12 padding | same as Compact |
| Row | 12 padding | 8 vertical, hairline between rows inset 44 | 4 vertical, min height 40, hairline inset 38 |
| Check box | 36 square, radius 11 | 30 square, radius 9 | 26 square, radius 8 |
| Name | 16/600 | 15/600 | 14/600 |
| Meta line | `case · usually 2.5`, 13 ink3 | 12 ink3 | hidden |
| Stepper buttons | 34 circles | 30 circles | 26 circles |
| Quantity | 19/700 tabular, min width 40 | 16/700, min 36 | 14/700, min 32 |
| Checked row | inset 1.5 accent ring on the card | no row change | no row change |

Row anatomy, left to right: check box, text block (name, meta), stepper
(minus, quantity, plus) with 4 gap between parts. Whole text block and the box
toggle the check. Stepper buttons never toggle off; changing a quantity on an
unchecked row checks it.

Check box states: unchecked = well fill, no border, empty. Checked = accent
fill, white check glyph (stroke 2.6) scaling 0 → 1 over 320ms with `pop`.
Fill colour changes over `dur`/`ease`. Press = scale 0.9 for 120ms.

Stepper states: unchecked = well buttons with ink glyph, quantity in ink3.
Checked = ink buttons with white glyph, quantity in ink. Press = scale 0.9.
Step is 0.5 for items whose unit is `case` or whose usual amount is fractional,
else 1. Floor is one step.

Newly added rows animate in: opacity 0 → 1, translateY -6 → 0, 380ms.

Pinned stack, 14 from each side, bottom edge 104 above the screen bottom:

1. Search results card (only while the query is non-empty): white, radius 22,
   max height 300, clips. Rows min 50, 6×14 padding, name 15/600, unit 12 ink3
   (`· on your list` suffix when present), trailing plus in accent, or a green
   check when already checked. No matches: centred `No items match “{q}”` in
   13 ink3. Opens with max-height + opacity + 8pt rise over `dur`.
2. Add bar: white, radius 26, 8 padding, add-bar shadow. Inside: search well
   (page-coloured pill, height 46, search glyph 18 ink3, input 15,
   placeholder `Add item`, clear button 24 well circle shown only with text,
   mic 36 tile accent) then the send button: 48 circle, accent, white arrow-up
   22. Disabled = `disabled` fill when nothing is checked. Badge: absolute
   -4/-4 top-right, min 20 × 19, ink fill, white 11/700 tabular count, hidden at
   zero, `pop` 320ms whenever the count changes. Press = scale 0.94.

Search matches case-insensitive substring of the item name across the whole
catalogue, first 6. Adding an item that is not on the list appends it to its
category (creating the section if needed), checks it, scrolls it to centre,
clears the query and toasts `{Name} added`. Adding one already on the list just
checks and scrolls to it.

Send opens the Review order sheet (6.1). After sending, the success screen
covers the tab: page background, 88 circle goodBg with a 44 green check
(scale 0.6 → 1, 420ms `pop`), `Order sent` 22/700, body
`{n} items went to your manager for review.` 14 ink2, accent `Done` button
(not full width). Done clears checks and resets quantities to usual, and the
order appears at the top of Past orders as `Today`.

### 2.2 Past orders (employee root, tab 2)

Header: `Past orders`, location pill. Body: label `This week` with `{n} sent`
on the right, one white card of rows; then label `Earlier` and an empty state
(receipt glyph in a 56 white circle, `Nothing older yet` 15/600,
`Orders stay here for 90 days.` 13 ink2).

Row: 36 well tile radius 12 with receipt glyph, date 15/600
(`Yesterday`, `Mon, Sep 7`), subtitle 13 ink2 `{n} items · {supplier} · {time}`,
trailing `Reorder` tint tag (11/700 uppercase accent). Row tap opens the order
detail sheet (6.2). Tag tap reorders immediately.

Reorder: every line of that order is put on the checklist, checked, with the
sent quantity; the app switches to Order and toasts
`Loaded {n} items from {date}`.

### 2.3 Settings (employee root, tab 3)

Header: `Settings`, well tag `Employee`. Body, in order:

1. Profile card: 46 tint avatar with the accent initial, name 15/600,
   `{Location} · {Role}` 13 ink2, chevron-right ink3. Pushes Profile (7.1).
2. Label `Ordering`, card: `Order reminders` (bell tile; subtitle `Not set` or
   the rule such as `Mon, Thu · 10:00 AM`; chevron-down) opens 6.3.
   `Checklist display` (sliders tile; subtitle `Compact · categories on`;
   chevron-down) opens 6.4.
3. Label `Help`, card: `Contact support` (help tile;
   `Message the manager or report a problem`; chevron-right; opens the
   external support URL). `About and legal` (shield tile; right slot `v2.3` 13
   ink3 then chevron-down) opens 6.5.
4. Label `Manager`, card (managers only): `Switch to Manager view`
   (swap tile; `Fulfillment, team and inventory`; chevron-right).
5. `Sign out` secondary button, full width, 14 above.
6. Brand footer: the smelter lockup at 22 high (as delivered, never
   recoloured), then `Smelter {version} ({build}) · Signed in as {name}` 12
   ink3, 26 above / 6 below, centred.

No Stock check row. No Cart, no Advanced, no Quick search, no Display and
Accessibility row.

Settings row anatomy (`lrow`): min height 60, 10×14 padding, 12 gap, 36 tile
radius 12 well with an 18 ink2 glyph, title 15/600, subtitle 13 ink2, hairline
between rows inset 14. Chevron-down means "opens a sheet", chevron-right means
"pushes a screen". Pressed row = well background 120ms.

### 2.4 Home (manager root, tab 1)

Header: `Good {morning|afternoon|evening}`, subtitle `{Weekday}, {Mon} {d}`,
location pill. Body:

1. Fulfillment hero card (white, radius 22, 16 padding): row `Fulfillment`
   17/700 with a warning tag `{n} waiting`; three stat tiles (well, radius 14,
   12 padding, number 22/700, caption 12 ink2): suppliers, items, notes;
   full-width accent `Review orders ›` button 12 below. Button opens the
   Fulfillment tab.
2. Label `Quick actions`, card of `srow`s (12×14 padding, 36 well tile radius
   12): `Reorder last {weekday}` / `{n} items · {first three names}…`;
   `Browse inventory` / `{N} items across {C} categories`;
   `Switch to Employee view` / `Place an order from the checklist`.
3. Label `Suggestions`, card with the empty state `Collecting more data` /
   `Suggestions appear here as more orders are placed.`

No Quick Order card, no search card, no browse-preview rows, no reminder
banner. No wordmark.

### 2.5 Fulfillment (manager root, tab 2, badge = pending suppliers)

Header: `Fulfillment`, subtitle `{s} suppliers · {i} items to send`, location
pill. Body: label `Order notes` + count, card of note rows (`{Employee} · {CODE}`
15/600, note 13 ink2). Label `Suppliers` + count, card of supplier rows: 38
well avatar with the initial, name 15/600, `{i} items · {p} people` with
` · {r} remaining` in warning colour when non-zero, chevron. Row pushes the
supplier review (7.3). Full-width accent `Send all · {s} suppliers` button with
the send glyph, 12 below. Label `Order later` + count, card rows
`{Item}` / `{Location} · {unit} · Order on {day}` (warning) with an `Edit` tag.

### 2.6 Past orders (manager root, tab 3)

Same header as 2.2 plus a chip row under it (`All`, one per supplier,
`Pending sync`; selected chip is ink). One card of rows: supplier 15/600,
`{date} · {n} items · {time}` 13 ink2, trailing status tag (`Sent` good,
`Pending sync` warning). Row opens 6.2.

### 2.7 Settings (manager root, tab 4)

Header: `Settings`, tint tag `Manager`. Body:

1. Profile card as 2.3 with `{locations} · Manager`.
2. `Team`: `Team` / `{n} people · invites and features`; `Access codes` /
   `Employee and manager sign-up codes`; `Supplier contacts` /
   `Numbers and send channels`; `User management` / `Suspend or delete
   accounts`. All push.
3. `Ordering`: `Inventory` / `{N} items · stations and units` (push);
   `Export format` / `Supplier message template` (push); `Order reminders`
   (sheet 6.3); `Checklist display` (sheet 6.4).
4. `Help`: `Contact support` / `Report a problem`; `About and legal` `v2.3`.
5. `Employee`: `Switch to Employee view` / `Place an order from the checklist`.
6. `Sign out`, brand footer, identical to 2.3.

Removed from today's manager settings: Display and Accessibility,
Notifications, Reminders (the old custom reminders), Quick Search, Quick Order
config, Past Orders row (it is a tab now).

---

## 3. Tab bar (dock)

Geometry: 18 from each side, bottom edge 12 above the screen bottom, height 80,
pill radius, ink background, tab-bar shadow, 6 inner padding. Content is a
`tabs` flex row (equal-width tabs) plus, on the Order tab only, a `more`
segment on the right: 1pt divider (`rgba(255,255,255,.18)`, 14 vertical
margins, 4 side margins) and a 54-wide `…` tab. The segment animates its width
0 ↔ 64 over 340ms `ease` so the tabs reflow smoothly when entering or leaving
Order.

Tabs: employee `Order` (list), `History` (clock), `Settings` (user). Manager
`Home` (home), `Fulfillment` (clipboard-check, count badge), `History`
(clock), `Settings` (user). Glyph 24 stroke 1.9. Inactive tab = dockFg glyph,
no label. Active tab = white glyph and an 11/600 white label under it, label
max-height 0 → 12 and opacity 0 → 1 over 260ms, 3 top margin.

Badge (Fulfillment): 18 tall, min 18, white fill, accent 11/700 count,
positioned at top 14, left = centre + 6.

Indicator: one accent pill, top/bottom 6 inset, exactly the active tab's
width, `translateX` to the active tab's left. It is a single element that
moves; the tabs themselves never change fill. Glide motion: position and
width interpolate with ease-out-cubic over 320ms, and keep tracking the target
for 380ms in total so the `more` segment's reflow is followed. No stretch, no
overshoot.

Drag: press anywhere on the dock except the `…` tab and move more than 6pt
horizontally to pick the indicator up. It follows the finger, clamped to the
tabs area; the tab under its centre turns white. Release selects that tab
(same transition as a tap) or, if nothing changed, the indicator glides home.
A press without movement is a normal tap.

Clearance helper: content bottom padding = 12 + 80 + 12 = 104 for the pinned
stack, 190 for scroll bodies under the add bar, 120 elsewhere.

---

## 4. Page change (Glide)

Outgoing screen: opacity 1 → 0 and translateY 0 → -6 over 180ms `ease`.
Incoming screen: opacity 0 → 1 and translateY 10 → 0 over 300ms / 340ms
`ease`, started on the same frame. On Order, the pinned stack additionally
drops translateY 28 and fades over 260ms when leaving, and rises back when
returning. Scroll positions persist per tab.

Pushed screens slide in from the right over 280ms `ease` with a
`-10 0 30 rgba(0,0,0,.12)` left shadow while the screen behind moves to
-24% and dims to 92% brightness. Back reverses it. An edge swipe starting
within 28pt of the left edge follows the finger; release past 110pt pops.

Manager ↔ Employee switch: current screens fade to 0 over 200ms, the new tab
set renders at its root (Home or Order) and fades in, indicator placed
instantly. Toast `Manager view` / `Employee view` for 1.3s.

---

## 5. Sheets (one component, every modal)

Sheet: page-coloured, top radius 30, sheet shadow, max height 88% of the
screen. Grab handle 36 × 4 `rgba(0,0,0,.2)`, 10 above / 4 below. Header: title
20/700 tracking -0.2 with optional 13 ink2 sub-line, and a 32 white circle X on
the right. Body scrolls; cards inside are white. Optional primary button
(accent, 50 tall, full width) in a footer with 10 top / 34 bottom padding;
sheets without one end with 22 of space.

Open: translateY 105% → 0 over 320ms `cubic-bezier(.2,.8,.2,1)`. Scrim
`rgba(20,18,14,.5)` fades over 240ms. Close reverses. No overshoot.

Drag: a vertical move over 6pt on the handle, header or a body that is
scrolled to the top picks the sheet up. Downward drag follows 1:1; release past
90pt or faster than 0.9pt/ms closes, otherwise it eases back over 320ms.
Upward drag: sheets marked expandable (Review order, order detail) move at
0.55× and, past 60pt, expand to 88% height on release; other sheets resist at
0.18× and ease back. From the expanded state a downward release collapses to
the content height first. Tapping the scrim or the X closes.

Reopening a different sheet from inside a sheet (for example Note from
Review order) closes the first, waits 240ms, then opens the second.

### 6.1 Review order
Title `Review order`, sub `{n} items · goes to manager review`. Card of
`kv` rows (name left, `{qty} {unit}` right 14/600, 12×14 padding, hairlines).
Label `Note` with accent `Add`/`Edit` action on the right; card with the note
text or `No note. The manager sees only the items.` in ink3. Primary
`Send {n} items`. Expandable.

### 6.2 Order detail
Title = date, sub `{supplier} · sent {time}`. Three stat tiles (items,
supplier, status). Label `Items` + count, card of `kv` rows. Label
`Message as sent` with accent `Show`/`Hide` toggle; hidden card holding the
archived message text in a monospace-free 14/1.45 block. Primary
`Reorder these {n} items`. Expandable.

### 6.3 Order-day reminder
Title `Order-day reminder`, sub `A push on your order days if you have not
sent one yet.` Label `Remind me on`, seven equal day chips (white, radius 14,
12 vertical padding, 13/600; selected = tint fill, accent text, 1.5 accent
inset ring). Label `At`, time row (white, radius 14): minus circle, `10:00 AM`
26/700 tabular, plus circle; hour steps, 5 AM to 8 PM. Primary `Set reminder`.

### 6.4 Checklist display
Title `Checklist display`, sub `How your list is shown.` Three radio cards
(white, radius 22, 14 padding; selected = tint fill, 1.5 accent ring, filled
accent radio): `Comfortable` / `One card per item, biggest targets`;
`Compact` / `Grouped rows with the usual amount`; `Dense` / `Tight rows, see
the whole list at once`. Label `Grouping`, card row `Show categories` /
`Group items under Fish, Produce, Dry goods` with a 44 × 26 switch (disabled
grey, accent when on, 20 knob, 18 travel). Primary `Done`. Changes apply live
behind the sheet.

### 6.5 About and legal
Title `About and legal`, sub `Smelter {version} ({build})`, lockup centred at
30 high, card of rows `Privacy policy`, `Terms of service`, `Open-source
licenses`, `Contact support`. No primary.

### 6.6 Quick actions (the `…` tab)
Title `Quick actions`, sub `For this checklist.` Card 1: `Clear checklist` /
`Uncheck everything, reset amounts`; `Save as default` / `Checked items start
the next order`; `Add note` or `Edit note` / `Attach a message to this order`
or `Sent with this order`. Card 2 (chevrons): `Checklist display`, `Receive
delivery`, `Recent orders` (switches to the History tab). Clear toasts
`Checklist cleared` with an `Undo` action.

### 6.7 Note
Title `Add note`/`Edit note`, sub `Goes with this order to the manager.`
White textarea min 110, placeholder `Example: the walk-in freezer is full,
hold the extra rice until Friday`. Primary `Save note`.

### 6.8 Location
Title `Location`, sub `Which restaurant is this for?`, radio cards per
location. Selecting closes and re-renders every root with the new location.

### 6.9 Profile sheets
`Your name` (`Also used to sign in, so it stays unique on the team.`, input,
`Save name`); `Add email` (`Optional. Used only to help you recover your
account.`, `Save email`, then toast `Check your inbox`); `Change PIN or
password` (PIN/Password segment, two inputs, `Save PIN`); `Delete your
account?` (`Type DELETE to confirm. This cannot be undone.`, input, primary
disabled until the input equals DELETE).

---

## 7. Pushed screens

Header: 40 white circle with chevron-left, title 20/700, optional right slot.
Back returns to the screen that pushed it. Profile pops to Settings, never to
Order.

### 7.1 Profile
76 tint avatar centred. Card: `Name` / value (chevron-down, opens name sheet);
`Email` / `Optional · for account recovery` (chevron-down); `Location` /
`{loc} · set by the manager` (dimmed, not tappable). Label `Security`, card:
`Change PIN or password` (lock tile, chevron-down); `Privacy choices` / `Data
we store and why` (eye tile, chevron-right, pushes). `Delete account`
destructive button (white, alert text, trash glyph) 16 below.

### 7.2 Team, Inventory, Receive delivery, list screens
Same grouped-list layout. Team: member rows (tint avatar initial, name,
`{location} · {features}`), right-slot `Invite` small accent button; label
`Defaults`, row `New employee defaults` / `Checklist on · everything else off`.
Member detail: `Works at` segment (Sushi / Poki & Pho / Both), `Features` card
with switches for `Checklist ordering` and `Tips` only, then
`Reset {First}'s PIN` and `Preview as {First}` secondary buttons.
Inventory: search input, category chips, rows `{name}` / `{category} · per
{unit}` with a `{usual} {unit}` tag, right-slot plus circle.

### 7.3 Supplier review (from Fulfillment)
Title = supplier, right slot warning tag `{r} remaining` or `Ready`. Stat tiles
(items, remaining, people). Tint card with the order note in accent text when
present. Label `Items` with accent `Auto-fill`; compact rows: name, `{Employee}
{qty} · {Employee} {qty}` breakdown, stepper. Label `Message preview` with
accent `Format` (pushes Export format); white card with the rendered message.
Footer: `Copy` secondary (flex 1) and `Share` accent (flex 1.4) with glyphs.

---

## 8. Toasts and success

Toast: ink pill radius 14, 11×16 padding, 13/600 white, centred, 200 above
the bottom, rises 10pt while fading in over 220ms, auto-clears after 2.2s
(1.3s for view switches). Optional action in tint text on the right. Only one
toast at a time; a new message replaces the old.

Copy seen in the reference: `{Name} added`, `Check some items first`,
`Loaded {n} items from {date}`, `Reminder set`, `Note added`, `Note removed`,
`Checklist cleared` + `Undo`, `Saved as default · {n} items`,
`Ordering for {location}`, `Manager view`, `Employee view`, `Copied`,
`Sent to {supplier}`, `Signed out`.

---

## 9. Module gating and navigation changes

- `ordering_advanced` ships **off** for every user and is removed from the
  manager-facing toggles (Team member Features, New employee defaults, User
  management Modules card, Invite "what they can use"). Advanced and Cart
  routes keep their guards and simply never appear. Do not delete the code.
- `stock_check` ships **off** for every user and is likewise removed from the
  manager-facing toggles. The employee Settings row is removed. Routes keep
  their guards.
- Employee tabs: Order, History, Settings. Manager tabs: Home, Fulfillment,
  History, Settings. `getVisibleEmployeeTabs` and the manager layout render
  from the same `TabBar` primitive with the dock spec in section 3.
- Back from Profile returns to Settings (`app/(tabs)/_layout.tsx` gets
  `backBehavior="history"`, or `EmployeeProfileScreen` replaces to
  `/(tabs)/settings`). Verify with a cold launch straight into Settings →
  Profile → back.
- Every modal in scope uses the one `Sheet`/`BottomSheetShell` pair with the
  section 5 behaviour. Raw `Alert.alert` and raw `Modal` usages on these
  screens are replaced (Cart is out of scope since it is hidden).
- Manager screens in scope stop importing `@/theme/design`, `GlassSurface`,
  `StackScreenHeader`, `ManagerScaleContainer` and the attached tab-bar
  options. They use `ScreenHeader`, `Card`, `ListRow`, `TabBar` and tokens.

---

## 10. Acceptance checklist (for the verifying agent)

Run on the Release QA simulator by UDID. For each line, capture a screenshot
and compare with the reference page at the same state.

1. Order tab at launch: header, category strip, Compact rows, add bar, dock
   with `…` segment, badge hidden, send disabled.
2. Check three items: boxes fill accent with the pop, quantities turn ink,
   badge shows 3 with the pop, send enabled, category counts update.
3. Plus on an unchecked row checks it and steps 0.5 for `case` items.
4. Type `al`: results card rises with 6 hits; add `Aluminum Foil`; it appears
   under Packaging, checked, toast shown, query cleared.
5. Send → Review order sheet (straight slide, no bounce); drag up expands to
   88%; drag down collapses then closes; send → success screen → Done clears.
6. History: tap a row → detail sheet with items and the Show/Hide message
   toggle; Reorder tag loads the lines and toasts.
7. Switch tabs by tap: indicator glides 320ms, no stretch; pages crossfade
   with the 10pt lift; add bar drops when leaving Order; `…` segment collapses
   smoothly.
8. Drag the indicator across the dock; release over History selects it.
9. Settings: no Stock check row; Order reminders and Checklist display open
   sheets; Profile pushes and back returns to Settings; lockup footer present.
10. Checklist display: all three densities match section 2.1; categories off
    gives one flat section.
11. Switch to Manager view: fade under 0.5s, toast gone by 1.3s. Home,
    Fulfillment (badge), History, Settings match sections 2.4 to 2.7.
12. Supplier row pushes the review screen; Share pops and toasts.
13. Manager Settings has no Display and Accessibility, Notifications,
    Quick Search or Quick Order rows; footer lockup present.
14. `ordering_advanced` and `stock_check` are off in a fresh account and
    absent from every manager toggle surface.
15. `npm run typecheck`, `npm run lint`, `npm run test:ci` green, with the new
    tokens and no `no-design-drift` suppressions.
