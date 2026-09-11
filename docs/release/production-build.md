# Production build and TestFlight submission (issue #47)

Written 2026-09-10 by the #49 verifier from `eas.json`, `app.json`,
`scripts/verify-production-env.cjs`, `docs/release/app-store-connect.md` and
issue #47. Nothing here was run. David runs every command below on his own
machine, signed in to the `gethubgod` Expo account and the Apple team
`TH8X9F2YUR` (decision 2).

Run everything from the merged `main` after the App Store 2.3 PRs land, in the
order the milestone comments give: #75, #54, #77, #78, #76, #79, #80, the #33
and #35 PRs, #82, #81, then the #49 PR.

## 1. Pre-build checks

Each check is a command plus the value it must produce. Stop on the first miss.

| Check | Command | Must show |
| --- | --- | --- |
| Clean checkout on main | `git status --short && git rev-parse --abbrev-ref HEAD` | no output, then `main` |
| Version and build source | `python3 -c "import json;a=json.load(open('app.json'))['expo'];print(a['version'],a['ios']['buildNumber'],a['runtimeVersion'])"` | `2.3 21 2.2`. `ios.buildNumber` is ignored: `eas.json` sets `appVersionSource: remote` and `autoIncrement: true` on the production profile, so EAS assigns the next build number itself. `runtimeVersion` is the fixed string `2.2`; OTA updates on the `production` channel must be published against the same runtime version or they will never be applied. |
| Bundle id and team | `python3 -c "import json;print(json.load(open('app.json'))['expo']['ios']['bundleIdentifier'])" && python3 -c "import json;print(json.load(open('eas.json'))['submit']['production']['ios'])"` | `com.babytuna.systems`, then `appleId babytuna1688@yahoo.com`, `ascAppId 6759226573`, `appleTeamId TH8X9F2YUR` |
| Production EAS environment | `eas env:list --environment production` | `EXPO_PUBLIC_SUPABASE_URL=https://whrohvitvmcrmedepurd.supabase.co` and an `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` that starts with `sb_publishable_`. The legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` may stay but is not used when the publishable key is present. If the publishable key is missing, the build fails on purpose in the pre-install hook (next row). |
| Pre-install hook dry run | `EAS_BUILD_PROFILE=production EXPO_PUBLIC_SUPABASE_URL=<value from env:list> EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<value from env:list> node scripts/verify-production-env.cjs --eas-hook` | `PASS: production API host and public key format.` This is the same script `package.json` runs as `eas-build-pre-install` on the EAS worker. |
| Voice flag decision | `eas env:list --environment production` | `EXPO_PUBLIC_ENABLE_QUICK_ORDER_VOICE` is read at build time (`src/features/ordering/QuickOrderScreen.tsx`, `voiceEnabled`). If it is absent or not `true`, the production build ships with the microphone hidden and the device session's voice step cannot run. Set it with `eas env:create --environment production --name EXPO_PUBLIC_ENABLE_QUICK_ORDER_VOICE --value true --visibility plaintext` only if voice is meant to ship. |
| Apple credentials | `eas credentials --platform ios` then choose production | distribution certificate and provisioning profile for `com.babytuna.systems` under team `TH8X9F2YUR`, Push Notifications capability present |
| Local gates | `npm run typecheck && npm run lint && npm run test:ci` | all exit 0 (on the #49 head: typecheck 0, lint 0 with the drift rule active, 89 suites and 1247 tests passed, 1 skipped) |
| EAS CLI | `eas --version` | `>= 2.0` per `eas.json` `cli.version`; `npm install -g eas-cli` if older |

## 2. Build

```sh
eas build --profile production --platform ios
```

What the profile does (`eas.json`): `autoIncrement: true`, `channel: production`,
`environment: production`, image `macos-sequoia-15.6-xcode-26.2`. The build
runs `npm run eas-build-pre-install`, which fails the build if the production
API host or publishable key is wrong.

When prompted:

- Apple account: sign in as `babytuna1688@yahoo.com` if credentials are not
  already on EAS.
- Team: `TH8X9F2YUR`. Refuse `94WMH54N38`; that id came from an uncommitted
  signing diff in an old checkout and is not the app's team.
- Let EAS manage the distribution certificate and provisioning profile.

Record the build id and the assigned build number from the output
(`Build details: https://expo.dev/accounts/gethubgod/projects/babytuna-systems/builds/<id>`).

## 3. Archive checks

Download the `.ipa` from the build page (or `eas build:list --platform ios --limit 1`
for the artifact URL), then unpack and inspect it. `<ipa>` is the downloaded file.

```sh
mkdir -p /tmp/smelter-ipa && cd /tmp/smelter-ipa && unzip -q <ipa>
APP=$(ls -d Payload/*.app)
```

| Archive check (issue #47) | Command | Must show |
| --- | --- | --- |
| Bundle id | `plutil -p "$APP/Info.plist" \| grep -E 'CFBundleIdentifier\|CFBundleDisplayName\|CFBundleShortVersionString\|CFBundleVersion'` | `com.babytuna.systems`, `Smelter`, `2.3`, the EAS-assigned build number |
| Smelter icon | `ls "$APP" \| grep -i AppIcon` then open the largest `AppIcon*.png` and compare with `assets/images/app-icon.png` | the silver Smelter mark, not the old Babytuna art |
| iOS 26 SDK | `plutil -p "$APP/Info.plist" \| grep -E 'DTSDKName\|DTPlatformVersion\|MinimumOSVersion'` | `iphoneos26.x`, platform `26.x` |
| aps-environment production | `codesign -d --entitlements :- "$APP" 2>/dev/null \| grep -A1 aps-environment` | `production`. Source keeps `development` in `ios/Babytuna/Babytuna.entitlements`; the distribution profile must replace it. If it reads `development`, push will not work on the shipped build. Stop and fix the provisioning profile capability before submitting. |
| Embedded JS | `ls -l "$APP/main.jsbundle" && python3 <repo>/scripts/verify-ios-release.py "$APP"` | a non-empty bundle and `PASS: Smelter identity, embedded JavaScript, valid update manifest and N bundled assets` |
| Production URL | `grep -c whrohvitvmcrmedepurd.supabase.co "$APP/main.jsbundle" && grep -c 127.0.0.1 "$APP/main.jsbundle"` | first count at least 1, second count 0 |
| Update channel and runtime | `plutil -p "$APP/Expo.plist" \| grep -E 'EXUpdatesURL\|EXUpdatesRuntimeVersion\|expo-channel-name\|EXUpdatesEnabled'` | `https://u.expo.dev/fd32384c-3175-4fef-81b4-1321513b386e`, runtime `2.2`, channel `production`, updates enabled |
| Signing team | `codesign -dvv "$APP" 2>&1 \| grep -E 'Authority\|TeamIdentifier'` | `TeamIdentifier=TH8X9F2YUR` |
| Privacy manifest | `plutil -p "$APP/PrivacyInfo.xcprivacy" \| grep -c NSPrivacyAccessedAPIType` | at least 4 (the four categories in `app.json`) |

## 4. Submit to TestFlight

```sh
eas submit --platform ios --profile production --latest
```

`--latest` picks the build from step 2. The submit profile carries the Apple id,
the App Store Connect app id `6759226573` and the team. Sign in with an app
specific password if prompted; never paste it into a chat or a file.

## 5. Verify in App Store Connect

1. My Apps, Smelter, TestFlight tab: the build appears under iOS Builds with
   the version `2.3 (<build number>)`, status moves from Processing to Ready to
   Test within about 15 minutes. If it stays in Processing for over an hour,
   check the email from Apple for a binary rejection (missing purpose string,
   invalid entitlement).
2. Export compliance: `app.json` sets `usesNonExemptEncryption: false`, so no
   compliance prompt should appear. If one appears, answer No to non-exempt
   encryption.
3. Add David's Apple id to an internal test group and install through the
   TestFlight app on the iPhone. Then run `docs/release/device-session.md` and
   record the results in issue #47.
4. App Store tab, version 2.3: fill the metadata from
   `docs/release/app-store-connect.md` after answering its 27 CONFIRM items
   (section "Every CONFIRM in one list"). Attach the build from step 1. Do not
   submit for review until the device session has passed and the reviewer
   account in that document's section 6 exists.

## 6. What this document does not cover

- No `eas build`, `eas submit` or `eas env:create` was run by the verifier.
- The Android build is out of scope for App Store 2.3.
- Signed simulator builds prove the JavaScript and native code, not
  distribution signing or push entitlements. Only the archive checks above do.
