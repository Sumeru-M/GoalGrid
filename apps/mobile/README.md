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
npm run ios            # or: npm run android  /  npm start then scan in Expo Go
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

## Status (Phase 1)

Smoke test only: [`App.tsx`](App.tsx) saves a demo profile, generates a plan via
the real backend API against AsyncStorage, and renders it — proving the engine +
backend + trained model run on-device. Verified headlessly: `tsc --noEmit` passes
and `expo export` bundles for iOS (602 modules, Hermes). The full screen port
(Dashboard, Calendar, Priority, Tasks, Setup, Reschedule) is Phases 2–3.
