#!/usr/bin/env python3
"""Record the issue #40 mutation pass into docs/release-readiness/report-content.json.

Idempotent: rerunning replaces the issue #40 entries rather than appending
duplicates. Every mutation carries the route driven, the screenshot captured,
the psql assertion section that proves it, and the honest result.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / 'docs/release-readiness'
EVIDENCE = 'e2e/issue-40'

MUTATIONS = [
    {
        'mutation': 'Quick Order send',
        'route': '(manager)/quick-order then the Confirm Location sheet',
        'driven': 'Typed the order, resolved the salmon unit in the Set Stock sheet, tapped Confirm order, then Confirm & Submit.',
        'screenshots': [f'{EVIDENCE}/10-quick-order-ready.png', f'{EVIDENCE}/11-quick-order-confirm-location.png', f'{EVIDENCE}/12-quick-order-submitted.png'],
        'assertion': '02-quick-order-send',
        'result': 'Pass',
        'detail': 'orders row 8db17aa4 written with order_number 3, status submitted, entry_method quick_order, plus two order_items (Fixture Rice 2 base, Fixture Salmon 3 base) and a submitted quick_order_sessions row.',
    },
    {
        'mutation': 'Stock count save',
        'route': '(tabs)/stock-check then (tabs)/stock-check-list',
        'driven': 'Opened Fixture Freezer, set Fixture Salmon to 6 case in the Set Stock sheet, tapped Done. The header moved to 1 of 2 checked.',
        'screenshots': [f'{EVIDENCE}/42-stock-check-list.png', f'{EVIDENCE}/43-stock-check-set-stock-sheet.png', f'{EVIDENCE}/44-stock-check-counted.png'],
        'assertion': '12-stock-count-save',
        'result': 'Fail',
        'detail': 'No database row. stock_updates and stock_check_sessions stayed at 0, area_items.current_quantity and storage_areas.last_checked_at were untouched. The count lives only in AsyncStorage. Filed as #69.',
    },
    {
        'mutation': 'Stock count offline sync',
        'route': '(tabs)/stock-check-list with the local API gateway stopped',
        'driven': 'Stopped the local Kong container, counted Fixture Rice (accepted with no error or offline indicator), restarted Kong, confirmed /rest/v1/ returned 200, force quit and relaunched the app, reopened Stock check.',
        'screenshots': [f'{EVIDENCE}/45-stock-check-offline-entry.png', f'{EVIDENCE}/46-stock-check-offline-saved.png', f'{EVIDENCE}/47-stock-check-after-reconnect.png'],
        'assertion': '13-stock-count-offline-sync',
        'result': 'Fail',
        'detail': 'Nothing flushed on reconnect because nothing was ever queued for the database. Same root cause as the save path. Filed as #69.',
    },
    {
        'mutation': 'Receive delivery',
        'route': '(tabs)/receive-delivery',
        'driven': 'Quick actions, Receive delivery, Receive Local QA Supplier delivery, flagged Fixture Salmon, set arrived quantity to 2, added a note, Save receipt with 1 flagged items.',
        'screenshots': [f'{EVIDENCE}/19-receive-delivery-lines.png', f'{EVIDENCE}/20-receive-delivery-flagged.png', f'{EVIDENCE}/21-receive-delivery-saved.png'],
        'assertion': '04-receive-delivery',
        'result': 'Pass',
        'detail': 'order_receipts row written with status partial, three order_receipt_items, the flagged line carrying received_qty 2 and the typed note.',
    },
    {
        'mutation': 'Fulfillment Send All',
        'route': '(manager)/fulfillment then (manager)/fulfillment-send-all',
        'driven': 'Fulfillment showed Suppliers 1 Ready. Tapped Send All (1 supplier), the screen listed Local QA Supplier with its message, tapped Copy to finalize.',
        'screenshots': [f'{EVIDENCE}/15-fulfillment.png', f'{EVIDENCE}/16-send-all-supplier-card.png', f'{EVIDENCE}/17-send-all-after-copy.png'],
        'assertion': '03-fulfillment-send-all',
        'result': 'Pass',
        'detail': 'past_orders row with share_method copy, three past_order_items, and every order_items row moved from pending to sent. The supplier fixture resolved. Issue #60 (Send All empty state) did not reproduce on this run.',
    },
    {
        'mutation': 'Invite create',
        'route': '(manager)/manager-settings/team-invite',
        'driven': 'Typed E2E Invitee, chose Sushi, kept the default module preset, tapped Create link.',
        'screenshots': [f'{EVIDENCE}/32-invite-form.png', f'{EVIDENCE}/33-invite-link-ready.png'],
        'assertion': '08-invite-create',
        'result': 'Pass',
        'detail': 'create-invite edge function wrote an invites row with the module preset, location_group sushi, a 7 day expiry and created_by set to the manager.',
    },
    {
        'mutation': 'Invite accept',
        'route': 'join?token=... then (auth)/invite-hello, (auth)/secure, (auth)/secure-pin, (auth)/ready',
        'driven': 'Signed out, opened the join deep link, Continue, chose Use your restaurant PIN, entered and confirmed a 4 digit PIN.',
        'screenshots': [f'{EVIDENCE}/38-invite-hello.png', f'{EVIDENCE}/39-invite-secure.png', f'{EVIDENCE}/40-invite-accepted.png'],
        'assertion': '11-invite-accept',
        'result': 'Pass',
        'detail': 'invites.used_at and used_by set, a users row and a pin login_identities row created, and four user_modules rows written from the preset. default_location_id stayed null because the fixture location short codes are FS and FP, not sushi.',
    },
    {
        'mutation': 'Credential change then login',
        'route': 'settings/profile then (auth)/sign-in',
        'driven': 'Change PIN or password, entered a new 4 digit PIN twice, Save PIN. Signed out and signed back in with the name and the new PIN.',
        'screenshots': [f'{EVIDENCE}/34-change-pin.png', f'{EVIDENCE}/36-signed-out.png', f'{EVIDENCE}/37-login-new-pin.png'],
        'assertion': '09-credential-change, 10-login-after-credential-change',
        'result': 'Pass',
        'detail': 'login_identities.secret_hash md5 moved from 0c5ac7d3 to b3cc9926 with a new updated_at. The following sign-in through login-with-name recorded a second successful login_auth_attempts pair and advanced auth.users.last_sign_in_at.',
    },
    {
        'mutation': 'Account deletion',
        'route': '(tabs)/profile',
        'driven': 'Delete account, Continue, typed DELETE, Delete account. The app returned to the welcome screen.',
        'screenshots': [f'{EVIDENCE}/49-delete-account-confirm.png', f'{EVIDENCE}/50-delete-account-typed.png', f'{EVIDENCE}/51-account-deleted.png'],
        'assertion': '14-account-deletion-before, 15-account-deletion-after',
        'result': 'Pass',
        'detail': 'delete-self removed the auth.users, users, profiles, login_identities and user_modules rows for the invitee and nulled invites.used_by while keeping used_at, so the invite cannot be reused.',
    },
    {
        'mutation': 'Order status changes',
        'route': 'orders/[id] in manager view',
        'driven': 'Opened the submitted order, Mark as Processing, Start Processing, then Mark as Fulfilled, Mark Fulfilled.',
        'screenshots': [f'{EVIDENCE}/23-order-detail-manager.png', f'{EVIDENCE}/24-order-processing.png', f'{EVIDENCE}/25-order-fulfilled.png'],
        'assertion': '05-order-status-changes',
        'result': 'Pass',
        'detail': 'orders.status moved submitted to processing to fulfilled with fulfilled_at and fulfilled_by set to the manager. The per-line pending to sent transition is covered by the Send All assertion.',
    },
    {
        'mutation': 'Reminder scheduling',
        'route': '(manager)/employee-reminders and (manager)/employee-reminders-recurring',
        'driven': 'Tapped Remind for E2E Employee and confirmed, then New Recurring Rule, employee scope, E2E Employee, two weekdays, Save Rule.',
        'screenshots': [f'{EVIDENCE}/27-reminder-sent.png', f'{EVIDENCE}/29-recurring-rule-form.png', f'{EVIDENCE}/30-recurring-rule-saved.png'],
        'assertion': '06-reminder-send, 07-reminder-scheduling',
        'result': 'Pass',
        'detail': 'send-reminder wrote a reminders row, a reminder_events sent row recording the push no_tokens outcome, and an employee_reminder notifications row. The recurring rule persisted to recurring_reminder_rules with days_of_week {2,4} at 15:00 America/Los_Angeles.',
    },
]

SCREENSHOTS = [
    (f'{EVIDENCE}/12-quick-order-submitted.png', 'Quick Order submitted',
     'Manager Quick Order after Confirm & Submit. The matching orders row is asserted in psql-assertions.md section 02-quick-order-send.'),
    (f'{EVIDENCE}/17-send-all-after-copy.png', 'Send All complete',
     'Send All finished for the resolved supplier fixture. past_orders, past_order_items and the pending to sent order_items transition are asserted in section 03-fulfillment-send-all.'),
    (f'{EVIDENCE}/21-receive-delivery-saved.png', 'Delivery received with a flagged line',
     'Receive delivery saved with one short line. The partial order_receipts row and its order_receipt_items are asserted in section 04-receive-delivery.'),
    (f'{EVIDENCE}/25-order-fulfilled.png', 'Order marked fulfilled',
     'Order status driven submitted to processing to fulfilled in manager view. Asserted in section 05-order-status-changes.'),
    (f'{EVIDENCE}/27-reminder-sent.png', 'Employee reminder sent',
     'send-reminder edge function confirmed delivery. reminders, reminder_events and notifications rows are asserted in section 06-reminder-send.'),
    (f'{EVIDENCE}/30-recurring-rule-saved.png', 'Recurring reminder rule saved',
     'A recurring rule scheduled for two weekdays at 15:00. Asserted in section 07-reminder-scheduling.'),
    (f'{EVIDENCE}/33-invite-link-ready.png', 'Invite link created',
     'create-invite returned a single use join link. The invites row is asserted in section 08-invite-create.'),
    (f'{EVIDENCE}/40-invite-accepted.png', 'Invite accepted through onboarding',
     'The invitee finished onboarding with a PIN. invites.used_at, the new user, login_identities and user_modules are asserted in section 11-invite-accept.'),
    (f'{EVIDENCE}/37-login-new-pin.png', 'Login after a credential change',
     'Signed back in with the changed PIN. The hash change and the successful attempt are asserted in sections 09 and 10.'),
    (f'{EVIDENCE}/44-stock-check-counted.png', 'Stock count saved in the UI only',
     'The screen reports 1 of 2 checked and current stock 6 case, but no database row exists. See section 12-stock-count-save and issue #69.'),
    (f'{EVIDENCE}/47-stock-check-after-reconnect.png', 'Stock counts survive a relaunch but never sync',
     'After the API gateway was restored and the app relaunched, the counts remain local. See section 13-stock-count-offline-sync and issue #69.'),
    (f'{EVIDENCE}/51-account-deleted.png', 'Account deleted',
     'delete-self returned the app to the welcome screen. The purged rows are asserted in section 15-account-deletion-after.'),
]

BLOCKERS = [
    {
        'title': 'Stock counts never reach the database (#69)',
        'detail': 'On the signed Release build against the local stack, saving a stock count writes nothing: stock_updates and stock_check_sessions stay empty, area_items.current_quantity and storage_areas.last_checked_at are untouched, and no queue flushes when connectivity returns. The count exists only in AsyncStorage on the device, so a manager never sees it and it is lost with the app container. Two of the ten mutations in issue #40 fail on this.',
    },
]

MARKER = 'issue #40'


def main():
    path = REPORT / 'report-content.json'
    data = json.loads(path.read_text())

    data['mutations'] = MUTATIONS

    data['screenshots'] = [s for s in data['screenshots'] if not s['path'].startswith(EVIDENCE)]
    data['screenshots'].extend({'path': p, 'title': t, 'caption': c} for p, t, c in SCREENSHOTS)

    data['blockers'] = [b for b in data['blockers'] if '#69' not in b['title']]
    data['blockers'].extend(BLOCKERS)

    data['checks'] = [c for c in data['checks'] if MARKER not in c['detail']]
    data['checks'].append({
        'command': 'FULL_STACK_PORT_BASE=54520 scripts/local-db/full-stack.sh up',
        'status': 'Pass',
        'detail': 'Local full stack booted for the issue #40 mutation pass. API 127.0.0.1:54521, database 54522. The service_role grants from issue #63 had to be applied by hand before any edge function worked.',
    })
    data['checks'].append({
        'command': 'scripts/release-readiness/setup-local-issue-40.sh',
        'status': 'Pass',
        'detail': 'Seeded the disposable issue #40 fixture: three auth users through the local GoTrue admin API, both release-readiness SQL fixtures, and known sign-in PINs. Loopback only, decision 3.',
    })
    data['checks'].append({
        'command': 'Mutation pass on EF05F833-2AC4-4383-8688-36C51B956BCF',
        'status': 'Review',
        'detail': 'Ten mutations from issue #40 driven on a Release simulator build of origin/main. Eight pass with a matching database row. Stock count save and stock count offline sync fail with no database write at all (#69). Every screenshot and psql assertion is in docs/release-readiness/e2e/issue-40.',
    })

    files = set(data['files'])
    files.update({
        'docs/release-readiness/e2e/issue-40/',
        'docs/release-readiness/e2e/issue-40/psql-assertions.md',
        'docs/release-readiness/mutation-pass-issue-40.md',
        'scripts/release-readiness/setup-local-issue-40.sh',
        'scripts/release-readiness/capture-issue-40.sh',
        'scripts/release-readiness/assert-issue-40.sh',
        'scripts/release-readiness/ui-summary.py',
        'scripts/release-readiness/record-issue-40.py',
    })
    data['files'] = sorted(files)

    path.write_text(json.dumps(data, indent=2) + '\n')
    print(f'Recorded {len(MUTATIONS)} mutations and {len(SCREENSHOTS)} screenshots into {path}')


if __name__ == '__main__':
    main()
