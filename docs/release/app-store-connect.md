# App Store Connect metadata draft

Drafted September 5, 2026 for issue #48, milestone App Store 2.3.

This is a draft for David to confirm or revise before anything is typed into App Store Connect.
Every line that starts with **CONFIRM:** needs his answer. Nothing here has been submitted, and no
account was created on the production backend by this worker.

Two inputs are fixed by decision 9 and decision 10 in `docs/launch-plan/index.html` section 8:

- Data retention answer for the privacy labels: retained 30 days, then deleted.
- Age rating answers: the minimum answer for every question.
- Support and privacy URLs must be verified working. They were fetched for this draft and the
  results are recorded in section 9.

Everything else below is a best assumption drawn from the repository, not a decision.

---

## 1. App record identity

| Field | Draft value | Source |
| --- | --- | --- |
| App name | Smelter | `app.json` `expo.name` |
| Bundle ID | `com.babytuna.systems` | `app.json` `ios.bundleIdentifier` |
| SKU | `smelter-ios` | New. Not present in the repo. |
| Apple ID (App Store Connect app) | 6759226573 | `eas.json` `submit.production.ios.ascAppId` |
| Apple developer account | babytuna1688@yahoo.com | `eas.json` `submit.production.ios.appleId` |
| Apple Team ID | TH8X9F2YUR | `eas.json` `submit.production.ios.appleTeamId` |
| Marketing version | 2.3 | `app.json` `expo.version` |
| Build number | Assigned by EAS | `eas.json` sets `appVersionSource: remote` with `autoIncrement` on production |
| Devices | iPhone only | `app.json` `ios.supportsTablet: false` |
| Encryption | Exempt, no non-exempt encryption | `app.json` `ios.config.usesNonExemptEncryption: false` |

CONFIRM: Apple team ownership. `docs/release-readiness/native-audit.md` records two team IDs in play,
`TH8X9F2YUR` in `eas.json` and `94WMH54N38` in an uncommitted signing diff in the main checkout. This
is decision 2 and it is still open. Metadata cannot be finalised against the wrong team record.

CONFIRM: SKU string. Any unique string works; it is never shown to users and cannot be changed later.

CONFIRM: Whether version 2.3 is still submittable, or whether App Store Connect requires a higher
version because 2.3 was already used. Only the App Store Connect record can answer this.

---

## 2. Categories, pricing, availability

| Field | Draft value | Reasoning |
| --- | --- | --- |
| Primary category | Business | The app is a workplace tool for restaurant staff, gated behind a manager invite |
| Secondary category | Productivity | Stock counts, ordering, checklists and reminders |
| Price | Free | No payment code exists in the app. The privacy policy states no payment card or bank details are collected. |
| In-app purchases | None | No StoreKit or purchase dependency in `package.json` |
| Availability | United States only | The product is sold to one restaurant group today |
| Content rights | Does not contain, show or access third party content | No third party media is displayed |

CONFIRM: Primary and secondary category.

CONFIRM: Territory availability. United States only is the conservative default. Worldwide is fine if
you want it, but it raises the bar on localisation and privacy questions.

---

## 3. App Store listing copy

### Subtitle (30 character limit)

```
Restaurant stock and ordering
```

29 characters.

### Promotional text (170 character limit)

```
Count stock, build orders and track tips from the floor. Managers invite the team, choose what each person can use, and see every order in one place.
```

149 characters.

### Description (4000 character limit)

```
Smelter is a back of house app for restaurant teams. A manager invites the staff, decides what each person can use, and the whole team works from the same records.

Smelter is a workplace tool. It is not a consumer app, and it cannot be used without an invitation from an organisation that already uses it.

STOCK CHECKS
Walk the walk-in and count what is there. Storage areas keep items in the order you actually check them, so a count takes minutes instead of a clipboard session. Past checks stay available for reference.

ORDERING
Build an order by browsing the catalogue, by typing a short line such as "4 cases romaine", or by speaking it. Simple ordering keeps it to a list and a send. Advanced ordering adds carts, drafts, past order reuse, and supplier grouping.

VOICE ENTRY
Hold the microphone and say what you need. Smelter turns speech into order lines you can review and correct before anything is sent. Voice is optional and only runs while you hold the button.

FULFILMENT
Managers see incoming orders from every employee and location, confirm what is being sent, and record deliveries as they arrive. Order history stays searchable.

TIPS
Record tip entries per shift and keep the running record in one place instead of on paper.

REMINDERS AND CHECKLISTS
Recurring reminders and daily checklists keep repeat work from being forgotten, with notifications when something is due.

TEAM MANAGEMENT
Managers invite staff with a link, set the location and role, and switch individual features on or off per person. Access can be revoked at any time.

PRIVACY
Smelter collects only what the workplace needs to run. There is no advertising, no tracking, and no sale of personal information. Camera, microphone and photo access are requested only when you use a feature that needs them. Accounts can be deleted from inside the app.

Support: https://smelterpos.com/support
Privacy: https://smelterpos.com/privacy
Terms: https://smelterpos.com/terms
```

CONFIRM: The description names Simple ordering, Advanced ordering (Beta), Stock check, Tips and
Fulfilment because those are the five module keys in `src/store/moduleStore.helpers.ts`. Advanced
ordering is labelled Beta in the app. Decide whether the listing should say Beta as well. Apple does
not reject the word, but it lowers reviewer expectations.

CONFIRM: British or American spelling. The draft uses "fulfilment" in prose while the code uses
"fulfillment". Pick one for the listing.

### Keywords (100 character limit, comma separated, no spaces after commas)

```
inventory,stock count,restaurant,kitchen,ordering,supplier,par level,back of house,prep,shift
```

93 characters. Do not repeat the app name or the category name; Apple already indexes those.

### What's New in This Version

```
First App Store release of Smelter. Stock checks, ordering, voice entry, fulfilment, tips, reminders and team management for restaurant teams.
```

CONFIRM: Whether this is a first release or an update to an existing record. App ID 6759226573
already exists in `eas.json`, so there may be prior versions with release notes to continue from.

### Copyright

```
2026 Babytuna Systems
```

CONFIRM: The exact legal entity name. The privacy policy says "Babytuna Systems is operated by the
developer identified on its App Store listing", which is circular. Apple shows this string publicly.

---

## 4. Privacy labels (App Privacy questionnaire)

Apple counts data as collected if the developer or any partner can access it beyond servicing the
request in real time. The answers below use that definition.

Global answers:

- Does your app collect data? **Yes.**
- Do you or your partners use data for tracking? **No.** `app.json` sets `NSPrivacyTracking: false`,
  the app links no advertising or attribution SDK, and no App Tracking Transparency prompt exists.
- Retention for every collected type: **30 days, then deleted** (decision 9).

### Data types collected

| Apple data type | Collected | Linked to identity | Tracking | Purpose | Evidence |
| --- | --- | --- | --- | --- | --- |
| Contact Info: Name | Yes | Yes | No | App Functionality | Declared in `app.json` privacy manifest. Profile and team screens store a display name. |
| Contact Info: Email Address | Yes | Yes | No | App Functionality | Declared in the privacy manifest. Optional, used by the legacy email sign-in path. |
| Identifiers: User ID | Yes | Yes | No | App Functionality | Declared in the privacy manifest. Supabase auth user ID on every record. |
| Identifiers: Device ID | Yes | Yes | No | App Functionality | Declared in the privacy manifest. `src/services/notificationService.ts` writes the Expo push token to `device_push_tokens` keyed by `user_id`. |
| User Content: Audio Data | Yes | Yes | No | App Functionality | `src/features/ordering/quickOrderVoice.ts` uploads an m4a recording to the `quick-order-voice-parse` function, and streams PCM to `quick-order-voice-stream`. Audio leaves the device. |
| User Content: Photos or Videos | Yes | Yes | No | App Functionality | Invoice and order screenshot parsing send an image to `parse-invoice` and `parse-order-screenshot`. |
| User Content: Other User Content | Yes | Yes | No | App Functionality | Declared in the privacy manifest. Orders, counts, notes, checklists, reminders and tip entries. |
| Contact Info: Other User Contact Info | Yes | Yes | No | App Functionality | Manager-entered supplier names and phone numbers, used by `manager-settings/supplier-contacts` and SMS sending. These are business contacts typed into the app, not read from the device address book. |
| Financial Info: Other Financial Info | Yes | Yes | No | App Functionality | The tips module records tip amounts per employee per shift. Apple's Other Financial Info category covers income. |
| Diagnostics | No | n/a | n/a | n/a | No crash or analytics SDK is installed. `package.json` contains no Sentry, Firebase, Amplitude, Mixpanel, PostHog, Segment or Datadog dependency. |
| Usage Data | No | n/a | n/a | n/a | No product analytics events are sent. |
| Location | No | n/a | n/a | n/a | No location permission is requested in `app.json`. "Location" in the app means a restaurant site chosen by a manager, not a device coordinate. |
| Health, Browsing History, Search History, Purchases, Sensitive Info, Contacts (address book) | No | n/a | n/a | n/a | No corresponding code path. |

CONFIRM: Financial Info. Declaring tip amounts as Other Financial Info is the cautious reading. If
you consider a tip entry a workplace record rather than the user's income, the answer changes to No.
Under-declaring is the risk that gets an app rejected; this draft over-declares deliberately.

CONFIRM: Other User Contact Info. Supplier phone numbers are third party contact details stored on
our servers. The alternative reading is that they are business records about a company, not personal
contact info. Choose one.

CONFIRM: Audio Data and Photos are declared as collected even though nothing in `supabase/functions`
writes them to a storage bucket. They are declared because the content is transmitted to Google and
we have no proof of what Google retains. See the provider note below.

### Voice and image provider

| Question | Answer from the code |
| --- | --- |
| Provider | Google Gemini, `https://generativelanguage.googleapis.com`. Models are set by env vars `QUICK_ORDER_VOICE_MODEL`, `TIP_VOICE_MODEL`, `GEMINI_LIVE_MODEL`, `INVOICE_PARSE_MODEL`. `gemini-2.5-flash` and `gemini-2.0-flash` appear as defaults. |
| Second provider | Anthropic, `https://api.anthropic.com/v1/messages`, reachable when `PARSE_ORDER_LLM_PROVIDER` selects it. Text only, not audio. |
| What is sent | Recorded audio as `audio/pcm;rate=16000` chunks over WebSocket to `quick-order-voice-stream`, or an m4a file to `quick-order-voice-parse`. Invoice and screenshot images go to `parse-invoice` and `parse-order-screenshot`. |
| Stored by us | No. No `storage.from(...)` or bucket upload exists in any voice or image edge function. The audio is proxied, parsed, and the structured result is returned. |
| Retained by us | 30 days, then deleted (decision 9). |
| Retained by the provider | Not established by this repository. |

CONFIRM: Google's retention terms for the API key in use. Google's paid Gemini API tier states that
prompts are not used to improve products and are retained only transiently for abuse detection, while
the free tier does not make that promise. Which tier the production `GEMINI_API_KEY` belongs to
decides whether "Google can access this beyond servicing the request" is true, and therefore whether
Audio Data must be declared at all. This worker cannot read the billing status of the key.

CONFIRM: Same question for the Anthropic key if `PARSE_ORDER_LLM_PROVIDER` is set to Anthropic in
production.

### Push notifications

Expo push tokens are stored server side in `device_push_tokens` with the owning `user_id`. They are
declared above as Device ID, linked to identity, App Functionality, no tracking. Note that issue #45
covers a server-side ownership rule for those tokens and is still open. That is a security issue, not
a labelling one, but it should close before submission.

### Privacy manifest

`app.json` already ships `NSPrivacyCollectedDataTypes` with Name, Email Address, User ID, Device ID
and Other User Content, all linked, none tracking, all App Functionality. If the answers above are
accepted, the manifest is missing Audio Data, Photos or Videos, Other User Contact Info and Other
Financial Info. The manifest and the App Store Connect answers should agree.

CONFIRM: Whether to extend the privacy manifest in `app.json` to match the final label answers. That
is a code change and belongs in a separate issue, not this document.

---

## 5. Age rating

Decision 9 fixes the answers at the minimum. Answer **None** or **No** to every question in the age
rating questionnaire, which produces a 4+ rating.

The following questions are the ones where the minimum answer is worth a second look before it is
submitted, because a reviewer can see the feature:

- **User generated content.** Employees type order notes, item names and tip entries. That content is
  visible only to other authorised members of the same organisation. There is no public feed, no
  profile discoverable by strangers, and no way for an uninvited person to reach any content. The
  minimum answer is defensible on that basis.
- **Messaging or chat.** The app has no chat. Supplier SMS is composed in the iOS system message
  sheet by the user, using `expo-sms`. Nothing is sent without the user pressing send in Apple's own
  UI.
- **Unrestricted web access.** The app opens three fixed links, terms, privacy and support, through
  `expo-web-browser`. There is no address bar and no arbitrary browsing.
- **Gambling, contests, medical, drugs, violence, sexual content, profanity, horror.** None present.

CONFIRM: David accepts the four readings above. If any is answered Yes, the rating rises above 4+.

---

## 6. Reviewer account

**No reviewer account was created.** This worker was instructed not to write to the production
backend. The credentials below are placeholders. Replace the bracketed values after the account is
created and before the metadata is entered in App Store Connect.

### Placeholder credentials for the App Review Information panel

```
Sign-in required: Yes
User name: App Review
Password:  [4 digit PIN, for example 2468]
```

The app signs in with a display name and a 4 digit PIN, not an email and password. App Store Connect
labels the two fields "User name" and "Password"; put the display name in the first and the PIN in
the second, and say so in the review notes so the reviewer is not confused by the field labels.

CONFIRM: Whether the reviewer account should be a manager or an employee. Recommendation: **manager**.
A manager account can reach every screen an employee can reach plus fulfilment, team management and
settings, so one account covers the whole app. An employee account would hide roughly a third of the
routes and invite a "cannot evaluate the app" rejection.

CONFIRM: Which location and which modules the reviewer account gets. Recommendation: a disposable
location containing a small catalogue of obviously fake items, with all five modules enabled, so that
stock check, both ordering modes, tips and fulfilment are all reachable.

### Steps to create the account, for David to run

These are taps in the production app, signed in as an existing manager. Nothing here is a command
this worker can run.

1. Open Smelter on your own device, signed in as a manager on the production backend.
2. Go to Settings, then Team.
3. Tap Invite someone.
4. Name: `App Review`.
5. Works at: select the disposable review location.
6. What they can use: enable Simple ordering, Advanced ordering, Stock check, Tips and Fulfilment.
7. Link expires in: choose the longest option available. The credentials must stay valid for the
   whole review, and a rejected build restarts the clock.
8. Create the invite and copy the link.
9. On a second device or a simulator, open the link. It opens Smelter at the invite screen.
10. Complete onboarding and set the PIN to a value you will not forget, then record it here.
11. Confirm the account lands on the manager home screen and that fulfilment, team and settings are
    all reachable.
12. Seed the review location with a handful of clearly disposable items and one sent order so the
    reviewer does not see empty screens everywhere.

CONFIRM: Manager invites are created by an existing manager. If there is no manager account on the
production backend yet, the reviewer account cannot be created this way, and the first manager has to
be provisioned another way, for example the access code flow in
`app/(manager)/manager-settings/access-codes.tsx`. Confirm which applies.

CONFIRM: The reviewer account must not be deleted or expire while the app is in review, including
during a resubmission. Note it somewhere it will not be cleaned up.

### Review notes (App Review Information, Notes field)

```
Smelter is a workplace app for restaurant staff. Access is by manager invitation only, so the
reviewer account below is required to see anything past the welcome screen.

SIGNING IN
1. Launch the app.
2. Tap "Sign in" on the welcome screen.
3. Enter the name shown in the User name field above. It is a display name, not an email address.
4. Enter the 4 digit PIN shown in the Password field above.
The account is a manager account and can reach every screen in the app.

WHAT TO TRY
- Stock check: count items in a storage area and save the check.
- Ordering: build an order by browsing, by typing a line such as "4 cases romaine", or by voice.
- Voice: hold the microphone button and speak. Speech is turned into order lines you review before
  anything is sent. The microphone runs only while the button is held.
- Fulfilment: view incoming orders, confirm what is being sent, record a delivery.
- Team: invite a member, change what a member can use, revoke access.

PERMISSIONS
- Microphone and speech recognition: only for the optional voice ordering feature.
- Camera: only for scanning QR codes and photographing invoices.
- Photo library: only for choosing a profile photo.
Every permission is requested at the point of use and the app works without any of them.

ACCOUNT DELETION
Settings, then Profile, then Delete account. This deletes the authentication account and personal
access from inside the app, with no email or phone call required.

NO PURCHASES
The app is free and contains no in-app purchases or subscriptions.

The backend is live production infrastructure. Data created by the reviewer account is confined to a
disposable test location and does not affect a real restaurant.
```

CONFIRM: The review notes above claim account deletion lives at Settings, Profile, Delete account.
That path exists in `src/features/employeeSettings/EmployeeProfileScreen.tsx` and calls the
`delete-self` edge function. Walk it once on the reviewer account before submitting, because Apple
guideline 5.1.1(v) rejects an app whose stated deletion path does not work.

---

## 7. Screenshots

iPhone only, so one size class is required.

| Size | Required | Device to capture on | Pixels |
| --- | --- | --- | --- |
| 6.9 inch | Yes | iPhone 17 Pro Max, the repo's pinned simulator | 1320 x 2868 portrait |
| 6.5 inch | Optional | Not needed if 6.9 inch is supplied | 1284 x 2778 portrait |
| iPad | Not applicable | `ios.supportsTablet` is false | n/a |

Apple accepts 3 to 10 screenshots. Draft list of 8, in order:

1. Home. The manager home screen with today's work visible.
2. Stock check. A storage area part way through a count.
3. Quick order. A typed order line resolving into catalogue items.
4. Voice ordering. The microphone held, with recognised order lines on screen.
5. Cart or draft order. The order about to be sent, grouped by supplier.
6. Fulfilment. Incoming orders from the team in one list.
7. Tips. A shift's tip entries.
8. Team. The member list with per-person module switches.

Capture with `scripts/sim.sh io screenshot <path>` on UDID `FCADAB49-3A22-4167-B3EB-F794BEB32D9E`, as
required by `AGENTS.md`. Do not use macOS screen capture.

CONFIRM: The screen list and their order. The first two screenshots are what most people see in
search results, so they should be the two clearest wins.

CONFIRM: Whether screenshots carry caption text overlays or are plain device captures.
Recommendation: plain captures for a first release, because overlays need design time and can be
added in a later version without a new binary.

CONFIRM: Every screenshot must show believable but disposable data. No real restaurant's supplier
names, prices or staff names. Issue #49 covers the full route screenshot pass and can supply frames,
but its captures are for the audit report, not the store listing, and must be re-checked for real
data before reuse.

CONFIRM: App preview video. Recommendation: skip for the first release.

---

## 8. Version release and other settings

| Field | Draft value |
| --- | --- |
| Version release | Manually release this version |
| Phased release for automatic updates | Not applicable to a first release |
| Routing app coverage file | None |
| Sign in with Apple | Not used |
| Game Center | Not used |
| Third party content rights | Does not contain third party content |

CONFIRM: Manual release is the draft because it lets you choose the moment the app goes live after
approval. Automatic release on approval is the alternative.

---

## 9. URL verification

Checked September 5, 2026 at 10:57 PDT from this worktree with
`curl -sIL -o /dev/null -w "final_url=%{url_effective} status=%{http_code} redirects=%{num_redirects}"`.

| URL | Status | Final URL | Redirects |
| --- | --- | --- | --- |
| https://smelterpos.com/support | 200 | https://smelterpos.com/support | 0 |
| https://smelterpos.com/privacy | 200 | https://smelterpos.com/privacy | 0 |
| https://smelterpos.com/terms | 200 | https://smelterpos.com/terms | 0 |
| https://smelterpos.com/contact | 200 | https://smelterpos.com/support | 1 |

All four resolve. The bodies were also fetched and contain real rendered content, not a placeholder
page. `/support` renders sections titled Account and access, App problems, and Contact the developer.
`/privacy` renders the policy.

These are the three URLs the app itself links, from `src/features/auth/legal.ts` and
`app/settings/about-support.tsx`. `/contact` is a redirect to `/support`, which is why the app's
Contact row and Support row land on the same page.

App Store Connect fields:

| Field | Value |
| --- | --- |
| Privacy Policy URL | https://smelterpos.com/privacy |
| Support URL | https://smelterpos.com/support |
| Marketing URL | Leave blank |

CONFIRM: The support page has no email address, no form and no phone number. It tells the reader to
"reach the developer through the contact method on the smelter App Store listing", which points back
at App Store Connect, which points at the support URL. Apple has rejected apps for exactly this loop.
Recommendation: add a real support email address to the support page before submitting. That is a
one-line change in `marketing/src/app/support/page.tsx` and a marketing site deploy, and it belongs in
a separate issue.

CONFIRM: Marketing URL is left blank because `marketing/src/app/page.tsx` renders "site is being
built". Fill it in only after the homepage is real. A marketing URL that leads to a placeholder is
worse than no marketing URL.

---

## 10. Open items blocking submission

Carried from `docs/release-readiness/native-audit.md` and the checks above. None of these are
metadata problems this document can solve.

1. Apple team ownership, decision 2, still open. Two team IDs exist.
2. `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is not set in EAS production. Every production build is
   blocked until it is, decision 1.
3. `aps-environment` is `development` in source. Distribution signing must produce the production
   APNs entitlement or push will not work in the shipped build.
4. A signed distribution archive has not been produced or validated. Issue #47 covers that.
5. The reviewer account does not exist yet. Section 6 above.
6. The support page contact loop, section 9.
7. Issue #45, server-side push token ownership, is open.

---

## Every CONFIRM in one list

1. Apple team ownership, TH8X9F2YUR or 94WMH54N38.
2. SKU string.
3. Whether version 2.3 is still submittable.
4. Primary and secondary category.
5. Territory availability.
6. Whether the listing says Advanced ordering is in Beta.
7. British or American spelling in the listing copy.
8. First release or an update to existing app record 6759226573.
9. Exact legal entity name for the copyright line.
10. Financial Info label for tip amounts, yes or no.
11. Other User Contact Info label for supplier phone numbers, yes or no.
12. Google Gemini API tier and its retention terms.
13. Anthropic key retention terms, if that provider is enabled in production.
14. Whether to extend the `app.json` privacy manifest to match the final labels.
15. Acceptance of the four age rating readings in section 5.
16. Reviewer account role, manager recommended.
17. Reviewer account location and enabled modules.
18. Whether a manager account already exists on production to issue the invite.
19. Reviewer account must survive the whole review, including resubmission.
20. Walk the Settings, Profile, Delete account path once before submitting.
21. Screenshot list and order.
22. Screenshot captions, plain captures recommended.
23. Screenshot data must be disposable, not a real restaurant's records.
24. App preview video, skip recommended.
25. Manual or automatic release after approval.
26. Add a real support contact method to the support page.
27. Marketing URL stays blank until the homepage is real.
