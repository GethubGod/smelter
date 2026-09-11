# Issue #36 UI sweep — settings and team screens

Screenshot status: **complete**. Captured 2026-09-10 from a Debug build of
`issue/36-settings-team-sweep` (Sol review fixes included) on simulator
`493660C2-D09B-4B39-AC50-705FFD205948` (iPhone 17 Pro Max, iOS 26.2), Metro on
port 8094, against the shared local stack at `http://127.0.0.1:54601`. The
employee shots are signed in as `e2e.employee@smelter.test`, the manager shots
as `e2e.manager@smelter.test`.

Routes were opened with `xcrun simctl openurl <udid> babytunasystems://<route>`
by explicit UDID; the member, preview and invite-link shots were reached by
tapping through Team, so they show real rows rather than an empty deep link.

| Screen | Route | Before | After |
|---|---|---|---|
| Employee profile | /settings/profile | docs/release-readiness/e2e/issue-40/48-employee-profile.png | docs/ui-sweeps/issue-36/after/01-employee-profile.png |
| Manager profile | /manager-settings/profile | docs/release-readiness/e2e/root-manager-profile.png | docs/ui-sweeps/issue-36/after/08-manager-profile.png |
| Notifications | /settings/notifications | docs/release-readiness/e2e/root-notifications.png | docs/ui-sweeps/issue-36/after/02-notifications.png |
| Reminders | /settings/reminders | docs/release-readiness/e2e/root-reminders.png | docs/ui-sweeps/issue-36/after/03-reminders.png |
| Display & accessibility | /settings/display-accessibility | docs/release-readiness/e2e/root-display-accessibility.png | docs/ui-sweeps/issue-36/after/04-display-accessibility.png |
| Stock settings | /settings/stock-settings | docs/release-readiness/e2e/root-stock-settings.png | docs/ui-sweeps/issue-36/after/05-stock-settings.png |
| Quick search | /settings/quick-search | docs/release-readiness/e2e/root-quick-search.png | docs/ui-sweeps/issue-36/after/06-quick-search.png |
| About & support | /settings/about-support | docs/release-readiness/e2e/root-about-support.png | docs/ui-sweeps/issue-36/after/07-about-support.png |
| Team | /manager-settings/team | docs/release-readiness/e2e/root-manager-team.png | docs/ui-sweeps/issue-36/after/09-team.png |
| Invite | /manager-settings/team-invite | docs/release-readiness/e2e/root-manager-team-invite.png | docs/ui-sweeps/issue-36/after/10-invite.png |
| Invite link | /manager-settings/team-invite-link | docs/release-readiness/e2e/issue-40/33-invite-link-ready.png | docs/ui-sweeps/issue-36/after/11-invite-link.png |
| Member | /manager-settings/team-member | docs/release-readiness/e2e/root-manager-team-member.png | docs/ui-sweeps/issue-36/after/12-member.png |
| Preview | /manager-settings/team-preview | docs/release-readiness/e2e/root-manager-team-preview.png | docs/ui-sweeps/issue-36/after/13-preview.png |
| Defaults | /manager-settings/team-defaults | docs/release-readiness/e2e/root-manager-team-defaults.png | docs/ui-sweeps/issue-36/after/14-defaults.png |
| Access codes | /manager-settings/access-codes | docs/release-readiness/e2e/root-manager-manager-settings-access-codes.png | docs/ui-sweeps/issue-36/after/15-access-codes.png |
| Supplier contacts | /manager-settings/supplier-contacts | docs/release-readiness/e2e/root-manager-supplier-contacts.png | docs/ui-sweeps/issue-36/after/16-supplier-contacts.png |
| Export format | /manager-settings/export-format | docs/release-readiness/e2e/root-manager-export-format.png | docs/ui-sweeps/issue-36/after/17-export-format.png |
| Quick order config | /manager-settings/quick-order-config | docs/release-readiness/e2e/root-manager-quick-order-config.png | docs/ui-sweeps/issue-36/after/18-quick-order-config.png |
| User management | /manager-settings/user-management | docs/release-readiness/e2e/root-manager-user-management.png | docs/ui-sweeps/issue-36/after/19-user-management.png |

## What to look for after the Sol review fixes

- `04-display-accessibility.png`: the unavailable "Large" options in UI scale
  and Button size are dimmed, and VoiceOver now announces them as disabled.
- `13-preview.png`: Preview-as renders the contract floating tab pill instead
  of a hand-drawn tab row. It is an illustration: no touches, no VoiceOver.
- `19-user-management.png`: account status is the contract `StatusPill`, a dot
  plus a word rather than a colour-only chip.
- `17-export-format.png`: the template editor is the contract `Input` in its
  multiline form, not a hand-styled `TextInput`.
- `08-manager-profile.png`: each managed location shows an Active or Inactive
  pill instead of a bare coloured dot.
