# GoalGrid — Frontend (AI Planner)

A React + Vite mobile UI implementing the AI Planner design, wired to the
**same on-device backend** the rest of the repo ships. There is no API server in
the loop: the frontend instantiates `createBackend()` in-process against a
`localStorage`-backed KVStore, so the browser *is* the device.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5178
```

## How it connects to the backend + engine

```
React screens
   │  api.ts  (typed wrapper)
   ▼
backend ApiClient ──► Router ──► Handlers ──► PlannerService ──► AI Engine
                                                   │
                                                   ▼
                                            LocalStorageKV  (implements KVStore)
                                                   │
                                                   ▼
                                         window.localStorage  (on device)
```

- [`src/lib/localStorageKV.ts`](src/lib/localStorageKV.ts) — a browser `KVStore`
  (the web analogue of React Native AsyncStorage). Swap this one file to run the
  identical UI on a real device store.
- [`src/lib/api.ts`](src/lib/api.ts) — instantiates the backend once and exposes
  typed calls that dispatch straight through the router (same validation and
  error mapping as the HTTP transport).
- [`src/lib/useAppData.ts`](src/lib/useAppData.ts) — central data hook; screens
  read from it and call `reload()` after mutations.

## Screens (match the uploaded design)

| Screen | File | Backend calls |
|--------|------|---------------|
| Setup wizard (4 steps) | [Setup.tsx](src/screens/Setup.tsx) | `PUT /profile`, `POST /goals`, `POST /priorities` |
| Dashboard | [Dashboard.tsx](src/screens/Dashboard.tsx) | reads cached weekly `POST /schedule/plan` |
| Calendar | [Calendar.tsx](src/screens/Calendar.tsx) | day strip + timeline over the schedule |
| Priority | [Priority.tsx](src/screens/Priority.tsx) | `GET /goals/:id/explain`, `POST /priorities` (re-plans live) |
| Tasks | [Tasks.tsx](src/screens/Tasks.tsx) | `POST /outcomes`, `DELETE /goals/:id` |
| Add Goal | [AddGoal.tsx](src/screens/AddGoal.tsx) | `POST /goals` (taxonomy via "domain > specific") |
| Reschedule | [Reschedule.tsx](src/screens/Reschedule.tsx) | `POST /schedule/reschedule` → AI summary |

## Verified behaviour

Driven end-to-end in a browser: completing setup persists the profile/goals to
`localStorage`, the engine produces a priority-ordered plan (Study P1 → Gym P2 →
Football P3, colour-coded on the Dashboard), the success ring and week bars
reflect real capacity/usage, reordering on the Priority screen re-teaches the
engine and re-plans, and Reschedule runs the engine's missed-day logic and shows
its summary. No network calls, no console errors.

## Design system (monochrome + platform-adaptive)

The UI is a **solid black-and-white** system — no accent hues. All theming flows
through CSS variables in [`src/styles.css`](src/styles.css), so components never
hardcode colors.

- **Monochrome tokens** — the accent is pure ink (white on dark, black on light).
  Buttons, the FAB, active tabs and rank badges are solid fills, not gradients.
- **Priority without color** — encoded as a grayscale ramp (`--p1`…`--p5`, strong
  → faint) plus explicit labels (Highest…Lowest), so hierarchy survives in pure
  B&W and is colour-blind safe.
- **Light & dark** — inverts automatically via `prefers-color-scheme`; the
  "featured" card (Today's Plan) is an inverted surface in both modes.
- **iOS / Android adaptation** — [`src/lib/platform.ts`](src/lib/platform.ts)
  detects the OS and sets `<html data-platform>`, switching corner radii,
  font stack (SF vs Roboto), title weight, press feedback (scale vs Material
  ripple), and tab-bar blur. Web falls back to the iOS profile.
- **Native UX details** — safe-area insets (`env(safe-area-inset-*)` +
  `viewport-fit=cover`), 44–48px minimum touch targets, `:focus-visible` rings,
  tap-highlight suppression, momentum scroll with `overscroll-behavior`, screen
  fade transitions, and `prefers-reduced-motion` support.

Verified in-browser in both light and dark schemes with no console errors.

## On-device / privacy

All user state lives in `window.localStorage` under the `goalgrid:` namespace.
Nothing is sent to a server. `DELETE /data` (wired via the backend) clears only
that namespace. To ship on real devices, replace `LocalStorageKV` with an
AsyncStorage/MMKV/SQLite-backed `KVStore` — no other frontend change is needed.
