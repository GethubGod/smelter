**Done**

- Swept `app/` and `src/` for em-dashes, en-dashes, and emoji in user-facing strings: 20 source files, 48 string replacements (32 dash, 16 emoji). Also synced 3 test files whose assertions checked exact copy that changed.
- Branch `issue/38-copy-sweep`, based on `55c01dc` (the `integration/app-store-2.3` head).
- Full change table and assumptions are in the PR body.

**Checks**

- `npm run typecheck`: pass
- `npm run lint` (zero warnings): pass
- `npx jest --runInBand --watchman=false --testPathIgnorePatterns '/node_modules/'`: pass, 1232/1233 tests (1 pre-existing skip)
- Dash grep and emoji grep: remaining hits are all in code comments, log strings, or the excluded categories below (documented in the PR body)

**Remaining / excluded on purpose**

- The twelve duplicate route files under `app/(tabs)` and `app/(manager)` (`cart`, `index`, `orders`, `profile`, `quick-order`, `voice`) are left for the #37 route-merge worker; a small follow-up sweep is expected after that merges.
- `CATEGORY_EMOJI` icon maps (fish/protein/produce/etc.) and two station icon fields are functional UI icons, not copy. Removing them is a restyle decision, not a copy fix, so they were left in place. Flagging for a follow-up decision on whether to replace with a real icon set.

**What to test**

- Quick Order chat error pills, "Got it" prefill messages, and the not-ordered dash marker on inventory rows.
- Manager inventory toasts and the four empty-state screens (icon is now blank).
- Voice add sheet prompts and the too-short error.
- Receive delivery "Save, all arrived" button.
- Stock check note placeholder and the unset-stock row marker.
- Quick Order welcome message.

GitHub was unreachable from this machine during the work (`gh`/`git push` connection reset). If this comment and the PR did not post automatically, they are also committed at `docs/ui-sweeps/issue-38/ISSUE-COMMENT.md` and `docs/ui-sweeps/issue-38/PR-BODY.md` on this branch.
