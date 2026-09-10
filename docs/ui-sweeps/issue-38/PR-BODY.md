Closes #38

"Merge after #80"

## Summary

Copy sweep for em-dashes, en-dashes, and emoji in user-facing strings across `app/` and `src/`. No behavior change, no restyle. Base commit for this branch: `55c01dc` (the local `integration/app-store-2.3` head at task start).

## Assumptions (stated, not asked)

- **Excluded duplicate route files**: the brief named "quick-order, voice, inventory-browse, orders, profile and the sixth duplicated pair" as the twelve excluded files under `app/(tabs)` and `app/(manager)`. A direct filename match between the two folders (`comm -12`) gives exactly six names and twelve files: `cart.tsx`, `index.tsx`, `orders.tsx`, `profile.tsx`, `quick-order.tsx`, `voice.tsx`. There is no `inventory-browse.tsx` in `app/(manager)` (it has `browse.tsx` and `inventory.tsx` as separate files, not an exact-name duplicate), so I used the literal "exists in both folders" rule instead of the example list and excluded `cart` and `index` in place of `inventory-browse`. Flagging this in case the other worker's merge scope differs.
- **Category/status icon emoji left untouched**: `CATEGORY_EMOJI` maps and their ~20 render call sites in `app/(manager)/inventory.tsx`, `src/features/ordering/QuickSearchScreenView.tsx`, and `src/features/inventory/ManagerInventoryRow.tsx` (fish/protein/produce/dry/dairy_cold/frozen/sauces/alcohol/packaging, plus `ADD_EMOJIS`), and the two station `icon` fields in `src/services/seedStations.ts`, are the only visual icon for those categories/stations, with no icon-library fallback. Dropping them would remove real UI iconography across dozens of render sites, not just tidy copy, and reads as a restyle decision, not a text sweep. Left them in place. A follow-up ticket to pick a real icon set (or confirm a documented decision to run without icons) is recommended before touching these.
- Standalone dash characters used as empty-value placeholders (`stockMath.ts`'s `'—'` for an unset stock row, `QuickOrderScreen.tsx`'s standalone `–` for "not ordered") were replaced with a plain hyphen `-`, since they're rendered text but not prose needing a comma/colon/period.
- Two-clause messages ("X. Y.") used a period where the pieces are separate facts/imperatives (most error messages), a comma where the second clause is a trailing qualifier ("Bump up, chef expecting..."), and a colon where the dash introduced a label:value pairing (`${action.label}: ${action.preview}`, "Say what you need: ...").
- `console.log`/`console.warn` strings and code comments (including JSDoc and JSX `{/* */}` blocks) were left untouched per the brief, even where a dash sits in an inline trailing comment.
- Two `src/__tests__/quickOrderContextNotes.test.ts` and one `quickOrderParser.test.ts` fixture still contain "Salmon — no order needed..." / "Above reorder range — no order needed." text. These are mock `no_order_reason` / `safety_warnings[].message` values simulating backend/LLM-generated text, not literals defined in our source (no matching string exists anywhere in `src` outside the tests), so they were left as-is per "test fixtures... unless you also update the assertion" (there's no corresponding source string to update in tandem, and this isn't UI copy we author). Also left `src/__tests__/quickOrderQuantityFlow.test.ts:241` and `cartHelpers.test.ts:331` alone: a Jest test-description string and an inline test comment, neither rendered to a user.

## Change table

| File | Before | After |
|---|---|---|
| `app/(manager)/fulfillment-history-detail.tsx` | `Failed to create reorder — no order ID returned.` | `Failed to create reorder. No order ID returned.` |
| `app/(manager)/inventory.tsx` | `` ✓ Added ${item...} `` (toast) | `` Added ${item...} `` |
| `app/(manager)/inventory.tsx` | `` ✓ Added ${reorderItems.length} items to cart `` | `` Added ${reorderItems.length} items to cart `` |
| `app/(manager)/inventory.tsx` | `✓ Stock settings updated` | `Stock settings updated` |
| `app/(manager)/inventory.tsx` | `✓ Item moved` | `Item moved` |
| `app/(manager)/inventory.tsx` | `✓ Item deactivated` | `Item deactivated` |
| `app/(manager)/inventory.tsx` | `` ✓ Removed ${bulkSelectedCount} item... `` | `` Removed ${bulkSelectedCount} item... `` |
| `app/(manager)/inventory.tsx` | `` ✓ Moved ${bulkSelectedCount} item... `` | `` Moved ${bulkSelectedCount} item... `` |
| `app/(manager)/inventory.tsx` | empty-state `icon = '🎉' / '🔍' / '📦' / '🎉'` (4 assignments) | `icon = ''` |
| `app/(manager)/export-fish-order.tsx` | `<Text ...>🐟</Text>` (x2) | `<Text ...></Text>` |
| `src/features/inventory/ManagerInventoryRow.tsx` | `'✓ Added'` | `'Added'` |
| `src/features/ordering/QuickOrderItemEditModal.tsx` | `This text didn't match an inventory item — pick one below.` | `This text didn't match an inventory item. Pick one below.` |
| `src/features/ordering/QuickOrderItemEditModal.tsx` | `The parser flagged this item for review — double-check it.` | `The parser flagged this item for review. Double-check it.` |
| `src/features/ordering/QuickOrderScreen.tsx` | `` Couldn't match "${flaggedItemName}" — tap ⓘ to pick it. `` | `` ...", tap ⓘ to pick it. `` |
| `src/features/ordering/QuickOrderScreen.tsx` | `` ${action.label} — ${action.preview} `` | `` ${action.label}: ${action.preview} `` |
| `src/features/ordering/QuickOrderScreen.tsx` | standalone `–` (not-ordered marker) | `-` |
| `src/features/ordering/QuickOrderScreen.tsx` | `Got it — your last inventory list is in the composer...` | `Got it. Your last inventory list is in the composer...` |
| `src/features/ordering/QuickOrderScreen.tsx` | `Got it — last week's order is in the composer...` | `Got it. Last week's order is in the composer...` |
| `src/features/ordering/QuickOrderScreen.tsx` | `Got it — your most recent order is in the composer...` | `Got it. Your most recent order is in the composer...` |
| `src/features/ordering/QuickOrderScreen.tsx` | `Got it — your usual order is in the composer...` | `Got it. Your usual order is in the composer...` |
| `src/features/ordering/QuickOrderScreen.tsx` | `Got it — I will not show that suggestion again for this order.` | `Got it. I will not show that suggestion again for this order.` |
| `src/features/ordering/QuickOrderScreen.tsx` | `Got it — try saying it differently.` | `Got it. Try saying it differently.` |
| `src/features/ordering/quickOrderContextNotes.ts` | `` No unit entered — counted ${itemName} in ${unit} `` | `` No unit entered, counted ${itemName} in ${unit} `` |
| `src/features/ordering/quickOrderErrors.ts` | `Quick Order is temporarily off — please use Browse.` | `Quick Order is temporarily off. Please use Browse.` |
| `src/features/ordering/quickOrderErrors.ts` | `I couldn't read that order. Try typing it again — one item per line.` (x2: `invalid_json` + `UNREADABLE_ORDER_MESSAGE`) | `...Try typing it again, one item per line.` |
| `src/features/ordering/quickOrderItems.ts` | `` — ${formatQuickOrderUnitName(unit, 1)} `` | `` - ${formatQuickOrderUnitName(unit, 1)} `` |
| `src/features/ordering/quickOrderResponse.ts` | `I couldn't answer that — try rephrasing.` | `I couldn't answer that. Try rephrasing.` |
| `src/features/ordering/quickOrderWelcome.ts` | `Welcome to Quick Order 👋` | `Welcome to Quick Order` |
| `src/features/ordering/quickOrderWelcome.ts` | `Type your order the way you normally would — no special format needed.` | `Type your order the way you normally would. No special format needed.` |
| `src/features/simpleOrder/components/VoiceAddSheet.tsx` | `That was too short — hold on a moment longer and try again.` | `That was too short. Hold on a moment longer and try again.` |
| `src/features/simpleOrder/components/VoiceAddSheet.tsx` | `Say what you need — "two cases of salmon, a bag of rice"` | `Say what you need: "two cases of salmon, a bag of rice"` |
| `src/features/simpleOrder/components/VoiceAddSheet.tsx` | `Heard "{addition.spokenUnit}" — this item orders in {addition.unit}` | `Heard "{addition.spokenUnit}", this item orders in {addition.unit}` |
| `src/features/simpleOrder/receiving/ReceiveDeliveryScreen.tsx` | `Save — all arrived` | `Save, all arrived` |
| `src/features/stock-check/components/SetStockBottomSheet.tsx` | `placeholder="Bump up — chef expecting big weekend rush"` | `placeholder="Bump up, chef expecting big weekend rush"` |
| `src/features/stock-check/utils/stockMath.ts` | `return '—';` (unset stock placeholder) | `return '-';` |
| `src/features/team/invitePreview.ts` | `Opens on order history — no ordering surface is on.` | `Opens on order history, no ordering surface is on.` |
| `src/lib/api/client.ts` | `Network error — please check your connection.` | `Network error. Please check your connection.` |
| `src/store/tunaSpecialistStore.ts` | `No internet — I've saved your order. I'll process it when you're back online.` | `No internet. I've saved your order. I'll process it when you're back online.` |
| `src/__tests__/inventoryStore.test.ts` | assertion synced to `client.ts` change (x2) | synced |
| `src/__tests__/quickOrderContextNotes.test.ts` | assertion synced to `quickOrderContextNotes.ts` change | synced |
| `src/__tests__/quickOrderWelcome.test.ts` | assertions synced to `quickOrderWelcome.ts` change (title + body) | synced |

20 source/app files touched, 3 test files updated to keep assertions in sync, 48 individual string replacements total (32 dash, 16 emoji).

## Excluded (by design)

- `app/(tabs)/{cart,index,orders,profile,quick-order,voice}.tsx` and `app/(manager)/{cart,index,orders,profile,quick-order,voice}.tsx` — owned by the route-merge worker (issue #37).
- `CATEGORY_EMOJI` icon maps and station `icon` fields (see Assumptions above) — functional icons, not copy; left for a follow-up decision.
- Code comments, JSDoc, JSX `{/* */}` blocks, `console.log`/`console.warn` strings, and `src/__tests__/quickOrderContextNotes.test.ts` / `quickOrderParser.test.ts` mock backend-message fixtures that have no corresponding literal in source.
- A second small pass is expected once #37 merges, to sweep whatever copy lands in the six now-merged duplicate route files.

## Commands and results

- `git rev-parse HEAD` before reset: did not match `55c01dc`; ran `git reset --hard 55c01dc` on the worktree branch, confirmed head matched.
- `git checkout -b issue/38-copy-sweep`
- `npm ci` (node_modules was missing) — installed clean, no blocking errors.
- `npm run typecheck` → **pass**, no errors.
- `npm run lint` (`eslint . --max-warnings 0`) → **pass**, zero warnings.
- `npx jest --runInBand --watchman=false --testPathIgnorePatterns '/node_modules/'` → **pass**: 85 of 86 suites run (1 pre-existing skip, unrelated), 1232 passed / 1233 total. Pre-existing `act(...)` console warnings in `managerInventorySelectorsPerformance.test.ts` are unrelated to this change and were not introduced by it.
- `grep -rnP "[\x{2013}\x{2014}]" app src --include='*.ts' --include='*.tsx'` → 246 hits remain, all in code comments, JSDoc, JSX comment blocks, `console.log`/`console.warn` strings, a Jest test description, an inline test comment, or the three no-source-counterpart test fixtures listed above. None outside those categories.
- `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F000}-\x{1F2FF}]" app src --include='*.ts' --include='*.tsx'` → 42 hits remain, all inside the excluded `CATEGORY_EMOJI`/station-icon set documented above.

## What to test

- Quick Order chat: error pills/messages for unresolved items, "Got it" prefill confirmations, and the not-ordered dash marker on inventory update rows.
- Manager inventory: toast messages (add/move/deactivate/bulk actions) and the empty-state screens (well-stocked, no search match, no category match, no filter match) — icon is now blank, text unchanged.
- Voice add sheet: too-short error, the "Say what you need" prompt, and the "Heard ..." unit-mismatch note.
- Receive delivery screen "Save, all arrived" button label.
- Stock check: the note placeholder text in the set-stock sheet, and an unset stock row showing `-` instead of `—`.
- Quick Order welcome message (title no longer has a wave emoji, body copy unchanged in meaning).
