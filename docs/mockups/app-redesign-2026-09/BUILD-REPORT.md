# Studio 2.4 build report

Implementation and local acceptance completed on `feat/ui-studio-2.4` in `.claude/worktrees/ui-studio-2.4`.
Base: `integration/app-store-2.3`, commit `b4ff479`. `git fetch origin main integration/app-store-2.3` confirmed the integration branch is not fully merged into `origin/main`. The worktree was 9 ahead and 24 behind after its first three checkpoints. No push, PR, deployment, or remote migration has been performed.

## Validation

Initial token and list changes:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: initial run failed because native test doubles lacked Animated. After updating the shared double, exit 0, 90 suites passed, 1 skipped; 1250 tests passed, 1 skipped.

Stage A complete, commit `ca0fb37`:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 91 suites passed, 1 skipped; 1259 tests passed, 1 skipped, 1260 total. Initial integration runs exposed missing native test mocks and two lint warnings; these were corrected before the green run.

Stage B complete:

- `npx jest src/__tests__/simpleOrderRecentOrders.test.ts --runInBand`: exit 1 before tests because sandbox access to Watchman's state directory failed.
- `npm run test:ci -- src/__tests__/simpleOrderRecentOrders.test.ts`: exit 0, 1 suite and 14 tests passed. This command uses the repository's Watchman-free CI configuration.
- `npx eslint src/features/simpleOrder/recentOrders.ts src/features/simpleOrder/HistoryScreen.tsx src/features/simpleOrder/components/OrderDetailSheet.tsx src/components/ui/GlidePage.tsx src/components/ui/StudioToast.tsx src/lib/switchViewMode.ts`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 93 suites passed, 1 skipped; 1276 tests passed, 1 skipped, 1277 total. Earlier runs caught a native gesture option type error and root-layout test doubles missing the new notification hosts; corrected before the green run.
- Simulator acceptance was pending at this Stage B checkpoint; final evidence is recorded below.

Stage C complete:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 96 suites passed, 1 skipped; 1291 tests passed, 1 skipped, 1292 total.
- `git diff --check`: exit 0.
- Worktree dependencies were cloned locally to isolate Expo quoting patches. `pod install --no-repo-update` initially failed in the sandbox on Hermes DNS, then succeeded with network access. Repeated after dependency isolation, it succeeded with 109 dependencies and 110 pods. Pod versions did not change; EXConstants and EXUpdates checksums reflect the required quoting patches.

Stage D complete:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 98 suites passed, 1 skipped; 1304 tests passed, 1 skipped, 1305 total. `employeeChecklistMeta.test.ts` passes unchanged because its service expectations do not depend on the hidden tabs.
- `git diff --check`: exit 0.
- Supabase CLI 2.113.0 created `20260912235714_ui_studio_hidden_module_defaults.sql`. It preserves user overrides and kitchen module defaults, normalizes hidden invite defaults, and keeps old client RPC payload keys accepted. No remote migration was applied.
- Receive delivery's landing list now uses the shared grouped rows and real order data.

Native build and launch:

- `scripts/sim.sh assert`: exit 0, pinned Smelter QA device booted and Nellit app absent.
- `npx expo start --port 8091`: Metro started in the worktree.
- `npx expo run:ios --device "$(scripts/sim.sh udid)" --port 8091 --no-bundler`: failed because Expo rejects these two flags together.
- `npx expo run:ios --device "$(scripts/sim.sh udid)" --port 8091`: Build Succeeded, 0 errors and 0 warnings; installed on the pinned device.
- Initial launch displayed `No script URL provided`. `scripts/sim.sh terminate com.babytuna.systems` followed by `scripts/sim.sh launch com.babytuna.systems -RCT_jsLocation localhost:8091` loaded the real welcome screen. Metro bundled 2371 modules. Existing SafeAreaView deprecation and require-cycle warnings appeared.
- Expo's generated local signing-team changes were removed from the worktree project file after the build. No signing configuration change is part of this UI deliverable.

Integrated visual correction gate:

- Escalated the supplier-review visual correction to GPT-6 Astra at medium effort after the remaining 20pt versus 16pt padding mismatch was found. Restored the dock on in-scope pushed routes and its active parent from navigation history. Added scroll and footer clearance to Inventory, Export format and Team screens.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0, 99 suites passed, 1 skipped; 1315 tests passed, 1 skipped, 1316 total.
- `git diff --check`: exit 0.

Checklist density correction gate:

- Astra corrected row geometry, exact check/step SVG paths, group edge spacing, separator offsets, checkbox fill versus checkmark motion, and control press timing. Dense section labels and counts now match the reference. Added `motion.controlEase` for the default CSS easing used by the reference's unqualified control transitions.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:ci`: exit 0, 99 suites passed, 1 skipped; 1315 tests passed, 1 skipped, 1316 total.
- `docker exec -i supabase_db_ui-studio-2.4 psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/local-db/ui_studio_modules_fixture.sql`: exit 0. Fresh employee and manager defaults, kitchen parity, stored overrides, authorization denial, and legacy payload normalization passed. Transaction rolled back.

Local acceptance backend and ordering probes:

- `FULL_STACK_PORT_BASE=54520 scripts/local-db/full-stack.sh up`: the initial health gate failed for Edge Runtime. The isolated stack was subsequently started with health checks ignored; schema loading completed with 31 migrations. Other local stacks were untouched.
- `FULL_STACK_PORT_BASE=54520 scripts/release-readiness/setup-local-issue-69.sh`: passed, disposable local accounts and fixtures loaded.
- Ignored `.env.local` targets `http://127.0.0.1:54521` with the local publishable key. The tracked remote environment was unchanged. Additional local fixture rows provide six `al` matches including Aluminum Foil. These are test data, not production records.
- `npm run verify:submit-order-rpc`, with the local environment preloaded: exit 0. The 8-parameter RPC resolved and denied the unauthenticated probe with HTTP 401 / 42501. This does not prove submission.
- `npm run audit:quick-order-recognition`, with the local environment preloaded: exit 0, 1 suite and 1 test passed against the local fixture catalog.
- Local sign-in initially failed with a connection message. Evidence: `build-captures/00-local-sign-in-blocker.png`. Sol traced this to Deno rejecting the generated Edge upstream hostname containing the dotted worktree suffix. The isolated Kong runtime was repaired with the commands below; Edge health returned HTTP 200 and name/PIN token exchange succeeded. No tracked infrastructure files or other containers changed.
  - `docker exec supabase_kong_ui-studio-2.4 sed -i 's|url: http://supabase_edge_runtime_ui-studio-2.4:8081/|url: http://edge_runtime:8081/|' /home/kong/kong.yml`
  - `docker exec supabase_kong_ui-studio-2.4 kong reload`
  - `curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:54521/functions/v1/_internal/health`
- Metro restarted with the isolated `.env.local`; a real local manager signed in. Five disposable local checklist rows were seeded for the acceptance walk. A five-item order submitted through the actual app and appeared in employee History. Supplier Share created an archive visible in manager History. The native share popup was dismissed without selecting a recipient.

## Deviations

- Native ScrollView keeps upward body gestures for scrolling. Expand or resist upward from the handle/header; a downward body pull at scroll top follows and dismisses/collapses the sheet. Direct body responder attachment and an ancestor capture responder both failed physical device checks. The final implementation observes forwarded touch events for downward pulls without taking ownership from native scrolling. Header expansion retains the exact 320ms easing and 88% detent. Scrolled-body and cancellation behavior is covered by unit tests; the short local history content did not provide a nonzero-offset device regression case.
- React Native Image requires a resolved width alongside the 22pt height to preserve the delivered lockup aspect ratio. Width is derived from the image's native dimensions, with no recoloring, crop, or backing container.

- The browser URL policy blocked opening the local `reference-glide.html`. Reference inspection uses its HTML, CSS, and interaction code. Interactive browser comparison has not been performed. No alternate browser or URL workaround was attempted.

- Privacy choices remains the existing functional sheet. The existing pushed support route has unrelated content, so it was not substituted for a privacy screen.
- Pending checklist orders have no archived supplier message. Their detail sheet shows the existing unavailable-message text when expanded; no supplier message is fabricated.

- The selected checklist location changes the visible group, but the existing submission service assigns the order to the user's manager-set default location. The UI work does not change this authenticated service contract.
- Employee History now reads the user's checklist submissions immediately and their own direct-send archives. Manager-created supplier archives are not exposed to employees by existing RLS. Pending submission detail cannot display a supplier message that has not been archived for that employee.
- Profile uses a 280ms horizontal transition with the contract easing, left shadow and 28pt/110pt edge-swipe rules. The tab navigator does not provide the reference's behind-screen parallax/dimming. Actual native Stack routes use 280ms simple-push; native easing, shadow/parallax and release threshold cannot be customized through the current native-stack API.
- Direct-send review retains its existing supplier-specific subtitle and Continue to send action. Voice, Quantity and legacy Recent Orders retain their domain controls inside shared Sheet chrome. Existing reminders retain Remove reminder.

- Supplier review retains the unit pill and overflow menu for existing conversion, supplier reassignment, order-later, note, removal and breakdown actions. Multiple real notes appear on separate accent lines. Secondary logistics forms retain their existing controls.
- Inventory uses the reference list and search layout. Existing edit and bulk actions remain available through row press and long press. A usual quantity tag appears only when the checklist service supplies a real recommendation.

- Legacy manager Settings leaf routes outside the redesign retain their existing dock hiding. Inventory, supplier review, Export format, Team, Invite, member detail and Defaults retain the dock as the reference shows.

## Reference discrepancies

- Reference `.btn.dan` explicitly uses alert text on white for destructive actions, despite the general status-color restriction. The delivered reference takes precedence for this destructive variant. Secondary buttons have no outline.

- Dense stepper gap is 2 in the reference, while the general written row anatomy says 4.
- Reference clears checks when sending succeeds, before Done rebuilds the list; written section 2.1 assigns clearing to Done.

## Simulator acceptance evidence

All device input and captures use `scripts/sim.sh` with the pinned QA UDID. AXe was supplied through `SMELTER_AXE_PATH`. `input tap --tap-style physical` and `input drag` delivered actual touch events. AXe's generic `input swipe` did not move the app; those attempts are not counted as passing gestures. Captures use `scripts/sim.sh io screenshot docs/mockups/app-redesign-2026-09/build-captures/<name>.png`.

- Items 1 to 4: Compact initial list, disabled send, three selected items, unchecked case increment to 1.5, six substring search results, Aluminum Foil inserted under Packaging and selected. Captures `01-order.png`, `02-selected.png`, `03-half-step.png`, `04-search-results.png`, `04-added-item.png`.
- Item 6: Employee History detail lists the five real submitted items, Show/Hide works, and Reorder loads them into Order. Pending supplier-message unavailability is displayed honestly. Captures `06-history.png`, `06-reordered.png`.
- Items 7 and 8: tap navigation and physical dock drag select History; More segment collapses away from Order. Captures `07-tabs.png`, `08-dock-drag.png`. Screenshots establish endpoints, not frame-accurate animation duration; configured timings are verified in code/tests.
- Items 9 and 10: reminder and display sheets open; Profile returns to Settings in the cold-launched session; raw lockup measures 22pt high. Comfortable, Compact, Dense and categories-off render distinct expected layouts. Captures `09-reminders.png`, `09-profile.png`, `09-settings.png`, `10-display.png`, `10-comfort.png`, `10-dense.png`, `10-flat.png`.
- Items 11 to 13: manager Home, Fulfillment, History chip row and detail sheet, supplier review and native Share, Settings groups and footer inspected. Share returns to Fulfillment and archives the local fixture. No recipient was selected. Captures `11-manager-home.png`, `11-fulfillment.png`, `11-manager-history.png`, `11-manager-detail.png`, `12-supplier-review.png`, `12-supplier-footer.png`, `12-shared.png`, `13-manager-settings.png`, `13-manager-footer.png`.
- Item 14: Member, Defaults, Invite and User management omit both hidden module toggles. SQL fixture verifies fresh role defaults and retained overrides. Captures `14-modules.png`, `14-defaults.png`, `14-invite.png`, `14-user-management.png`.

## Runtime correction validation

- Astra corrected NativeWind dropping function-valued Pressable styles. Search mic, sheet close, Fulfillment rows and Team feedback now use static layout styles or explicit animated views.
- Header/handle drags needed responder ownership at touch start while retaining the 6pt visual movement threshold. Native translation and JS-driven height now use separate animated views. A clean launch verified the review header moving from y587.7 to y136.7, equivalent to an 841.3pt sheet on a 956pt display, then collapsing to its original height and dismissing on the next downward drag. X also closes normally.
- Success uses a full-window iOS overlay: centered ring, text and Done, with the dock covered. Done returned to `5 items · 0 selected` and disabled send. Captures `05-review.png`, `05-expanded.png`, `05-collapsed.png`, `05-dismissed.png`, `05-success.png`, `05-done-cleared.png`.
- The first final gate passed typecheck and lint but failed 5 tests in 2 suites. Existing credential mocks lacked `radius`; sheet tests relied on an animated-view array index that changed when animation drivers were separated. Tests now use the complete shared scaling mock and identify views by their behavior. The focused rerun passed 2 suites and 17 tests before the subsequent body-drag regression was added.
- Profile back was repeated after the final cold launch and returned to Settings with a settled-screen single tap. Some rapid automated taps during transitions did not act; those attempts are not counted as successful navigation checks.

## Final validation

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0, no warnings.
- `npm run test:ci`: exit 0. 99 suites passed, 1 skipped; 1322 tests passed, 1 skipped, 1323 total. Existing renderer deprecation and test-fixture warnings remain in Jest output.
- `git diff --check`: exit 0.
- `scripts/sim.sh assert`: exit 0, pinned QA device and Nellit absence verified again.
- Body-at-top downward drag physically verified after the touch-event correction. Capture `05-body-dismissed.png`. Upward body input left the sheet open; nonzero-offset scrolling is covered by regression tests rather than claimed from the short fixture content.
- Native build command and result are recorded above. Final JavaScript ran in that native build through Metro on port 8091. No native dependencies were added.
- All 14 acceptance items were walked with local fixture data. Captures are endpoint evidence; exact animation duration is established by implementation/tests, not inferred from still images. The local HTML reference could not be opened under browser policy, so visual comparison used its source contract.

## Changed files and review scope

- `src/theme/tokens.ts`, shared UI primitives, `BottomSheetShell.tsx`, navigation adapters and layouts: Studio surfaces, dock, sheets and Glide motion.
- `src/features/simpleOrder/`, `src/features/employeeSettings/`, receiving landing and shared credential sheets: employee checklist, History, Settings, Profile and overlays.
- `app/(manager)/` in-scope routes, home/fulfillment/team features and `settingsSections.ts`: manager surfaces and shared dock.
- `moduleStore.helpers.ts`, `employeeDefaults.ts`, module-toggle consumers and the new migration file (applied only locally): hidden module defaults and controls.
- `src/__tests__/` relevant regression tests, `scripts/local-db/ui_studio_modules_fixture.sql`, and `ios/Podfile.lock` quoting-patch checksums.
- `build-captures/` contains acceptance screenshots and the initial local sign-in blocker evidence.

## Remaining risks

- No remote migration, deployment, push or PR was performed. David must review the migration before applying it remotely.
- The selected-location submission contract and employee archive RLS limitations remain as described under Deviations.
- Supplier Share retains existing finalization semantics: opening Share marks the local supplier queue sent even if the native popup is subsequently dismissed. No external recipient was selected during testing.
- Existing local API Edge routes for inventory and supplier resolution returned 404; the app's direct Supabase fallbacks succeeded. Name/PIN auth was independently repaired and verified. The worktree's ignored local environment and isolated QA containers remain available for local review.
