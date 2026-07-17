# GoalGrid — AI Planner Engine

A self-contained, zero-dependency TypeScript engine that turns a user's profile
and goals into a prioritised, time-allocated schedule — and reschedules it when
days are missed. Pure functions + one stateful façade, so it runs **on-device**
(React Native) or **server-side** unchanged.

```bash
npm install
npm test      # 10 assertions, no framework
npm run demo  # end-to-end weekly plan for a student
```

## What it does

Given the required inputs — **priority tasks**, **occupation**, **age**,
**sleep hours**, and **daily commitment hours** — it emits a schedule over a
**daily / weekly / monthly / yearly** horizon, placing higher-priority work
first and fitting everything into the free time that remains after sleep and
commitments.

## Architecture

| Module | Responsibility |
|--------|----------------|
| [`src/types.ts`](src/types.ts) | Domain model (profile, goals, taxonomy, schedule) |
| [`src/priority.ts`](src/priority.ts) | Hierarchical priority learning + score computation |
| [`src/capacity.ts`](src/capacity.ts) | Free-time model: 24h − sleep − commitments |
| [`src/scheduler.ts`](src/scheduler.ts) | Greedy priority-ordered time allocation across the horizon |
| [`src/engine.ts`](src/engine.ts) | `AIPlannerEngine` façade — ingest signals, plan, reschedule |

## The three mechanisms

### 1. Hierarchical priority learning

Priorities live on a **category taxonomy**, e.g. `["sports", "football"]`. When
the user declares `football = level 2`, the engine propagates that signal *up*
the tree with geometric decay, so the **`sports` domain** absorbs a prior near 2
as well. A later `chess = 4` pulls the `sports` prior between the two. Any
**unseen** activity (`tennis`, `cricket`) then **inherits** the blended domain
prior via Bayesian shrinkage — exactly the "infer sports is level 2 from
football, then specialise per sport" behaviour. An explicit `declaredPriority`
on a goal always overrides inference.

```ts
engine.declarePriority(["sports", "football"], 2);
engine.explain(cricketGoal, today).priorityLevel; // ≈ 2, learned from football
```

### 2. Priority scoring

`score = priorityWeight × urgency × contextMultiplier × followThrough`

- **priorityWeight** — learned/declared level 1..5 mapped to 5..1 (dominant term)
- **urgency** — ramps up as a deadline nears, spikes when overdue
- **context** — mild occupation/age priors (student → study↑, age 40+ → health↑);
  these fade as the user's own behaviour accumulates
- **followThrough** — categories the user actually completes get a small boost

### 3. Time allocation & reschedule

Per day the scheduler computes free intervals, sorts outstanding work by score,
and greedily places each goal's next session — honouring `timePreference`
windows, session sizing, and per-day capacity — rolling unfinished work forward.
`engine.reschedule(...)` replans from "today" after missed days, feeds the misses
back into the learner, and returns a diff summary like the app's Reschedule
screen ("Study time increased by 1.5h", "Football moved to Friday").

## Integrating with the app

```ts
const engine = new AIPlannerEngine(profile, savedLearningStore);
const schedule = engine.plan(goals, { horizon: "weekly", from: "2026-07-17" });
// persist engine.getLearningStore() so learning survives across sessions
```

`Schedule.days[].blocks` map directly onto the Dashboard / Calendar screens;
`Schedule.unscheduled` surfaces goals that don't fit so the UI can warn the user.

## Backend infrastructure (local-first, on-device)

All user data is stored **on the user's own device**. There is no user database
in the cloud. The backend is a layered, modular system that runs inside the app
runtime; an optional Node server exists only for local dev and a *stateless*
compute mode that persists nothing.

```
device app
   │  (in-process calls — no socket)
   ▼
ApiClient ──► Router ──► Handlers ──► PlannerService ──► AI Engine (src/)
                                            │
                                            ▼
                                      Repositories
                                            │
                                            ▼
                                        KVStore  ──►  AsyncStorage / MMKV /
                                     (on device)      SQLite / IndexedDB
```

| Layer | Files | Responsibility |
|-------|-------|----------------|
| Storage adapter | [`backend/storage/kvstore.ts`](backend/storage/kvstore.ts) | Async key-value contract; `Memory`/`File` impls (device binds AsyncStorage/MMKV/SQLite) |
| Repositories | [`backend/storage/repositories.ts`](backend/storage/repositories.ts) | Typed, namespaced documents (profile, goals, learning, schedules, outcomes) |
| Service | [`backend/services/plannerService.ts`](backend/services/plannerService.ts) | Business logic: rehydrate engine from device state, run, persist model back |
| Validation | [`backend/api/validation.ts`](backend/api/validation.ts) | Zero-dependency request validators at the boundary |
| Router | [`backend/api/router.ts`](backend/api/router.ts) | Framework-agnostic dispatch (`:param` routes, structured errors) |
| Handlers | [`backend/api/handlers.ts`](backend/api/handlers.ts) | The full REST surface → service calls |
| Composition | [`backend/index.ts`](backend/index.ts) | `createBackend(kv)` → `{ store, service, router, client }` |
| Transport | [`backend/server.ts`](backend/server.ts) | Optional `node:http` adapter over the same router |

### Why key-value?

The whole persistence layer sits on a 5-method async KV contract, which maps 1:1
onto every practical on-device store — React Native AsyncStorage/MMKV, Expo
SQLite, web IndexedDB. Swapping storage is one line: `createBackend(myKVStore)`.
Nothing above the repository layer knows how bytes are stored.

### API surface

```
GET/PUT   /profile
GET/POST  /goals        GET/PUT/DELETE /goals/:id    GET /goals/:id/explain?today=
POST      /priorities   { category, level }          POST /outcomes { goalId, completed, date }
POST      /schedule/plan { horizon, from }           GET  /schedule?horizon=
POST      /schedule/reschedule { horizon, from, replanFrom, missedDates[] }
DELETE    /data   (erase everything on device)       GET  /health
```

### Using it on-device (no HTTP)

```ts
import { createBackend } from "./backend";
const { client } = createBackend(asyncStorageKV); // your KVStore impl
await client.put("/profile", profile);
await client.post("/priorities", { category: ["sports", "football"], level: 2 });
const { body } = await client.post("/schedule/plan", { horizon: "weekly", from: "2026-07-17" });
```

```bash
npm run test:backend   # 19 API integration tests
npm run server         # optional local HTTP server on :8787
```

### Privacy posture

- Data is per-device and per-user; a device store holds exactly one user's world.
- `DELETE /data` wipes the local store (backs a "delete my data" action).
- The HTTP server is for dev / optional stateless compute only — a production
  compute deployment builds a fresh in-memory store from the posted payload and
  retains nothing after responding.

## Notes & next steps

- Dates are treated as timezone-neutral calendar dates (UTC-normalised).
- The scheduler is a greedy priority packer; a future pass could add
  cross-day load-balancing and spaced-repetition for study goals.
- Learning is currently supervised by explicit signals + completion outcomes;
  time-spent telemetry could be added to `learnCompletion` for finer weights.
