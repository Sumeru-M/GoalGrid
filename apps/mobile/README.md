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

npm run web            # fastest — opens in a browser, no native toolchain
npm run ios            # iOS Simulator (needs Xcode)
npm run android        # Android emulator (needs Android Studio)
npm start              # dev server; scan the QR with a matching dev client
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

> ⚠️ **SDK note:** this app is on **Expo SDK 57 (React 19 / RN 0.86)** — very new.
> If it won't open in the App-Store Expo Go, use a **dev build**
> (`eas build --profile development`) or pin to the current **stable** SDK before
> release. Pinning is the lower-risk choice for shipping.

## Known follow-ups

- Promote the `link-core.sh` shim to formal **npm workspaces** so CI can build
  the app without the postinstall link.
- Extract a shared `goalgrid-client` package to de-duplicate
  `format`/`api`/`useAppData` between web and mobile.
