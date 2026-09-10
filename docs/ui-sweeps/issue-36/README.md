# Issue #36 UI sweep — settings and team screens

Screenshot status: **blocked**. Simulator device `493660C2-D09B-4B39-AC50-705FFD205948` and its
lock `/tmp/smelter-sim-lock-493660C2` were held throughout this session by a live `expo run:ios`
process from the concurrent issue-34 worker (worktree `agent-af93d2906567fbcc9`, pid 94704). The
process had been running ~11 hours with no new Metro log output in the final 10+ minutes I waited,
which looks orphaned, but I was not authorized to kill another issue's process or device install,
so I did not force the lock. See the PR body for details and the recommended follow-up.

The table below lists every owned screen, its route, and the existing "before" capture. "After"
paths are left blank pending a follow-up screenshot pass once the device is free.

| Screen | Route | Before | After |
|---|---|---|---|
| Employee profile | /settings/profile | docs/release-readiness/e2e/issue-40/48-employee-profile.png | (pending) |
| Manager profile | /manager-settings/profile | docs/release-readiness/e2e/root-manager-profile.png | (pending) |
| Notifications | /settings/notifications | docs/release-readiness/e2e/root-notifications.png | (pending) |
| Reminders | /settings/reminders | docs/release-readiness/e2e/root-reminders.png | (pending) |
| Display & accessibility | /settings/display-accessibility | docs/release-readiness/e2e/root-display-accessibility.png | (pending) |
| Stock settings | /settings/stock-settings | docs/release-readiness/e2e/root-stock-settings.png | (pending) |
| Quick search | /settings/quick-search | docs/release-readiness/e2e/root-quick-search.png | (pending) |
| About & support | /settings/about-support | docs/release-readiness/e2e/root-about-support.png | (pending) |
| Team | /manager-settings/team | docs/release-readiness/e2e/root-manager-team.png | (pending) |
| Invite | /manager-settings/team-invite | docs/release-readiness/e2e/root-manager-team-invite.png | (pending) |
| Invite link | /manager-settings/team-invite-link | docs/release-readiness/e2e/issue-40/33-invite-link-ready.png | (pending) |
| Member | /manager-settings/team-member | docs/release-readiness/e2e/root-manager-team-member.png | (pending) |
| Preview | /manager-settings/team-preview | docs/release-readiness/e2e/root-manager-team-preview.png | (pending) |
| Defaults | /manager-settings/team-defaults | docs/release-readiness/e2e/root-manager-team-defaults.png | (pending) |
| Access codes | /manager-settings/access-codes | docs/release-readiness/e2e/root-manager-manager-settings-access-codes.png | (pending) |
| Supplier contacts | /manager-settings/supplier-contacts | docs/release-readiness/e2e/root-manager-supplier-contacts.png | (pending) |
| Export format | /manager-settings/export-format | docs/release-readiness/e2e/root-manager-export-format.png | (pending) |
| Quick order config | /manager-settings/quick-order-config | docs/release-readiness/e2e/root-manager-quick-order-config.png | (pending) |
| User management | /manager-settings/user-management | docs/release-readiness/e2e/root-manager-user-management.png | (pending) |
