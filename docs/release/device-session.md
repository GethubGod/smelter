# Guided device session on the TestFlight build (issue #47)

Written 2026-09-10 by the #49 verifier. David runs this on his iPhone with the
TestFlight build from `docs/release/production-build.md`, signed in to the
production backend. Record each step's result in issue #47 as pass or fail
with a screenshot. Nothing below was run by the verifier; the simulator cannot
prove push, microphone, camera, SMS or a real invite link.

## Before you start

- Two accounts on production: your manager account (call it M) and a
  disposable employee account (call it E) created through an invite from M.
  E is deleted in step 7, so do not use a real employee.
- A second phone, or Messages on a Mac, that can receive an SMS from the
  supplier phone number you will use in step 4.
- One supplier contact in Settings, Supplier contacts, whose phone number is
  a number you control.
- At least one pending order from E in Fulfillment (make one in step 2 or 4).
- iPhone Settings, Smelter: Notifications allowed, Microphone and Camera not
  yet decided (so the permission prompts show), Cellular Data on.
- The invite link from step 5 is opened from Mail or Messages, not typed.

Steps say "tap" for a tap and "expect" for what must be on screen. If an
"expect" fails, stop that step, screenshot it, note the step number, and move
on to the next step.

## 1. Push after user switch

Proves `device_push_tokens` ownership (#45): after switching users on one phone,
the old user's pushes must not land on it.

1. Launch Smelter. Tap Sign in. Enter E's name and PIN. Tap Sign in.
2. Expect the checklist. If iOS asks to allow notifications, tap Allow.
3. On a second device (or the same phone later), signed in as M: Manager home,
   tap Employee reminders, tap E's row, tap Send reminder.
4. Expect on E's phone: a banner from Smelter within about 30 seconds.
5. On E's phone: Settings tab, tap Sign out, confirm.
6. Expect the welcome screen. Tap Sign in, enter M's name and PIN, tap Sign in.
7. Expect Manager home on the same phone.
8. As M, from any device: Employee reminders, tap E's row, tap Send reminder.
9. Expect on the phone now signed in as M: no banner for E's reminder within
   two minutes. Any banner here is a fail (the token still belongs to E).
10. As M, send a reminder to yourself, or ask a second manager to send you one.
11. Expect a banner on the phone signed in as M.

## 2. Microphone (voice order)

The mic is only built in when `EXPO_PUBLIC_ENABLE_QUICK_ORDER_VOICE=true` was in
the production EAS environment at build time (`production-build.md`, step 1). If
the composer shows no microphone button, record "mic not built in" and skip.

1. Signed in as M: Manager home, tap Advanced ordering.
2. Expect the chat composer with a microphone button.
3. Press and hold the microphone.
4. Expect the iOS prompt "Smelter would like to access the microphone". Tap
   Allow. If a speech recognition prompt follows, tap Allow.
5. Press and hold again, say "two cases of salmon", release.
6. Expect the transcript to appear in the composer or as a parsed line in the
   Order list card with a quantity and an item, within about five seconds.
7. Tap Send if the text landed in the composer.
8. Expect the item in the Order list card. Tap the item's remove control so
   nothing is ordered.
9. Open iPhone Settings, Smelter. Expect Microphone on. Turn it off, return to
   the app, press and hold the mic.
10. Expect an in-app message about microphone access, not a crash.

## 3. Camera (QR scanner)

On this head no screen mounts `src/components/QrScannerModal.tsx`; a repo search
finds no route or button that opens it. The camera permission string is still
declared in `app.json` (`NSCameraUsageDescription`). Record the observation:

1. Signed in as E or M, open Stock check, Manager home, Settings and Profile.
2. Expect no Scan QR control anywhere. If you find one, tap it and expect the
   iOS camera prompt "Smelter uses the camera to scan QR codes", then a live
   camera view; point it at any QR code and expect the app to react without
   crashing.
3. Photo library instead (the only image permission a screen reaches): Settings
   tab, Profile, tap the profile photo.
4. Expect the iOS photo picker (limited or full access prompt). Choose a photo.
5. Expect the new photo on the profile row.

If no Scan QR control exists, record "QR scanner not reachable on 2.3" in
issue #47. It is a listing question (the camera purpose string appears on the
App Store privacy sheet), not a blocker for the device session.

## 4. SMS Send All

Uses `expo-sms`, so the iOS Messages sheet opens; nothing is sent until you tap
the blue arrow in Messages.

1. Signed in as E: Order tab, add one item, tap Review order, tap Confirm and
   submit. Expect "Order submitted".
2. Sign out, sign in as M. Manager home, tap Fulfillment.
3. Expect the supplier group with E's order and a Send All button.
4. Tap Send All.
5. Expect the Send All screen listing the supplier with its message and a Send
   (SMS) action.
6. Tap Send.
7. Expect the iOS Messages sheet with the supplier number in To and the order
   text in the body.
8. Tap the send arrow in Messages. Expect Messages to close and Smelter to mark
   the supplier as sent.
9. Expect the SMS on the phone that owns the supplier number.
10. Fulfillment history: expect the order under Past orders with share method
    SMS.
11. Repeat steps 4 to 7 and tap Cancel in Messages. Expect Smelter to leave the
    supplier unsent, with no error boundary.

## 5. Invite link open

1. Signed in as M: Settings, Team, tap Invite someone.
2. Name: `Device Session Invitee`. Works at: your test location. Leave the
   module preset. Tap Create link.
3. Expect the Invite link ready screen. Tap Share and send the link to yourself
   by Messages or Mail.
4. On the same phone: Settings tab, Sign out.
5. Open Messages or Mail, tap the link (`https://tips.babytunasystems.com/join/<token>`).
6. Expect Safari's join page with "Open in app". Tap Open in app.
7. Expect Smelter opens on "Hello, Device Session Invitee", Step 1 of 2. Tap
   Continue.
8. Expect Step 2 of 2 with the PIN and password cards. Tap Use your restaurant
   PIN, enter a four digit PIN, confirm it.
9. Expect the Ready screen, then the checklist after tapping See today's list.
10. Sign out. Tap the same link again.
11. Expect the join page to say the link was already used (or the app to refuse
    it inline). No second account may be created.
12. As M, Settings, Team: expect the invitee in the member list. Leave this
    account for step 7.

## 6. Offline relaunch with a queued count

Proves #69 and #74: a count taken offline reaches the database on the next
launch, before any stock screen opens.

1. Signed in as the invitee (or E) with Stock check enabled: Stock tab, open a
   storage area, tap an item, set a quantity, tap Done.
2. Expect the row marked as checked and a count in the header.
3. Turn on Airplane Mode. Tap a second item, set a quantity, tap Done.
4. Expect the row accepted with no error.
5. Swipe up to the app switcher and swipe Smelter away (force quit). Keep
   Airplane Mode on.
6. Turn Airplane Mode off. Wait ten seconds. Launch Smelter.
7. Expect the app to land on its first screen (checklist or home). Do not open
   Stock check.
8. As M on another device (or after step 9 on this one): Manager home, Inventory.
9. Expect the second item's quantity, updated within a minute of the relaunch
   in step 6, before anyone opened Stock check on the counting phone.
10. On the counting phone, open Stock check. Expect no sync error text and both
    counts still shown.

## 7. Account deletion

Uses the invitee from step 5 so nothing real is lost.

1. Signed in as the invitee: Settings tab, Profile.
2. Expect the Delete account row at the bottom. Tap it.
3. Expect the confirmation sheet asking you to type DELETE.
4. Type `DELETE`. Tap Delete account.
5. Expect the app to return to the welcome screen within a few seconds.
6. Tap Sign in, enter the invitee's name and PIN.
7. Expect an inline sign-in refusal (no such account), not a crash.
8. As M: Settings, Team. Expect the invitee gone from the member list.

## Record

For each of the seven steps, post in issue #47: pass or fail, the iPhone model
and iOS version, the TestFlight build number, and a screenshot of the failing
"expect" if any. Step 3 records "not reachable" unless a Scan QR control exists.
