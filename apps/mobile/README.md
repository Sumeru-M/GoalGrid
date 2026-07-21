# GoalGrid — Mobile (React Native / Expo)

The native app. It reuses the **exact same** engine (`src/`) and backend
(`backend/`) as the web app — they're pure TypeScript behind the `KVStore` seam,
so the only platform-specific piece is the storage adapter
([`src/AsyncStorageKV.ts`](src/AsyncStorageKV.ts), the RN twin of the web's
`localStorageKV.ts`).

## Run it

```bash
cd apps/mobile
npm install            # also links the shared core (postinstall)
```

Pick the path that matches what you have installed:

| Path | Command | Needs |
|------|---------|-------|
| **Browser** (fastest, no toolchain) | `npm run web` | nothing |
| **iOS Simulator** | `npm run ios` | Xcode + a simulator |
| **Android emulator** | `npm run android` | Android Studio + JDK |
| **Physical device (recommended)** | build a **dev client** (below), then `npm start` | Expo account (free) |

### Physical device — use a development build, not Expo Go

This app runs on the current **latest** Expo SDK (57). Expo Go from the app
stores only ever supports the latest SDK, so it *should* load the app — but a
dev build is the reliable, version-independent way (and what you'll ship). The
`development` profile in [`eas.json`](eas.json) targets `expo-dev-client`:

```bash
npm i -g eas-cli && eas login
eas build --profile development --platform ios      # or android
# install the resulting build on your device, then:
npm start                                            # opens in your dev client
```

If imports of `goalgrid-core` / `goalgrid-backend` ever fail to resolve, re-link:
```bash
npm run link-core
```

## How the shared core is wired

`src/` and `backend/` are named packages (`goalgrid-core`, `goalgrid-backend`)
linked into `node_modules` by [`scripts/link-core.sh`](scripts/link-core.sh).
Metro follows the links like any workspace package (see `metro.config.js`), and
`tsconfig.json` `paths` mirror them for the type-checker. The shared code is
never copied or forked.

> This is a lightweight monorepo link. A follow-up can promote it to formal npm
> workspaces so CI can build the app without the postinstall step.

## Status

All seven screens are ported (Setup, Dashboard, Calendar, Priority, Tasks,
AddGoal, Reschedule) with the monochrome theme, numeric priorities, and the
trained model bundled into the JS. Verified headlessly (`tsc` + `expo export`)
and end-to-end on the **web target** (`react-native-web`), which exercises the
real RN components + the full engine/backend. Native device runs are the
remaining validation step (see below).

## Release (EAS)

App identity lives in [`app.json`](app.json) (name **GoalGrid**, bundle id
`com.goalgrid.app`, black splash, light/dark automatic). Build profiles are in
[`eas.json`](eas.json).

```bash
npm i -g eas-cli        # once
eas login               # your Expo account
eas build --profile preview  --platform ios       # simulator build to validate
eas build --profile production --platform all      # store-ready binaries
eas submit --profile production --platform ios      # needs Apple Developer acct
```

Store submission requires **your** Apple Developer / Google Play accounts and
signing credentials — those steps are owner-only.

> **SDK note:** this app is on **Expo SDK 57** — which is the current **latest
> stable** release (`expo` dist-tag `latest`), not a canary. Expo Go supports
> only the latest SDK, so *staying* on 57 is what keeps it Expo-Go-loadable;
> downgrading would break that. For reliable, version-independent device runs
> use the **development build** above (`expo-dev-client` is installed and the
> `development` EAS profile is configured). `npx expo-doctor` → 20/20.

## Known follow-ups

- Promote the `link-core.sh` shim to formal **npm workspaces** so CI can build
  the app without the postinstall link.
- Extract a shared `goalgrid-client` package to de-duplicate
  `format`/`api`/`useAppData` between web and mobile.
