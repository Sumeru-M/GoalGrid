# GoalGrid — Decision Log

Append-only. Maintained by the `product-manager` agent. **MAJOR** = owner-approved
(with chosen option). **MINOR** = PM-ruled within approved scope.

| Date | Type | Decision | Chosen by / rationale |
|------|------|----------|----------------------|
| 2026-07-17 | MAJOR | Product direction: ship as a real mobile app (React Native/Expo) rather than web-PWA-first | Owner |
| 2026-07-17 | MAJOR | Expo **managed** workflow (CNG; `app.json` is source of truth) | Owner-approved plan |
| 2026-07-18 | MAJOR | Commits are owner-performed; agents only flag ready-to-commit | Owner directive |
| 2026-07-21 | MAJOR | Stay on **Expo SDK 57** (registry shows it is the current latest stable; Expo Go tracks latest) + fix run path via `expo-dev-client` instead of downgrading | Owner (after premise correction) |
| 2026-07-21 | MAJOR | **Defer** npm-workspaces conversion and shared `goalgrid-client` package until a real driver exists | Owner accepted recommendation |
| 2026-07-23 | MAJOR | Native iOS validation performed on-simulator; generated `apps/mobile/ios|android` trees stay gitignored (CNG) | Owner-approved continuation |
| 2026-07-23 | MAJOR | Adopt the engineering-org governance: 11 role subagents, PM-gated decisions, owner approval required for all MAJOR items and phase gates | Owner |
| 2026-07-23 | MINOR | Model assignment for role agents: opus for judgment-heavy roles (PM, architect, AI/ML, security, code-reviewer), sonnet for execution-heavy | PM ruling at org creation |
| 2026-07-23 | MAJOR | Pending work committed as **two commits**: infrastructure unit (b333cf7 — CI mobile typecheck gate, docs refresh, CNG ignores) then governance unit (cbc30e5 — subagents + PM governance) | Owner chose "Two commits"; both landed |
| 2026-07-23 | MINOR | Accepted QA static regression gate on current tree (root/frontend/mobile tsc clean; 43/43 tests green); QA's "uncommitted files" note ruled stale — tree verified clean post-commits | PM ruling on QA report acceptance |
| 2026-07-23 | MINOR | Fix 🔴1 (reschedule ignores completion history) via option (a): plannerService passes completedMinutesFromHistory() into both reschedule plans | PM — matches existing plan() pattern; restores intended behavior |
| 2026-07-23 | MINOR | Fix 🟡2 (web Priority.tsx async effect) by porting mobile's try/catch + cancellation | PM — parity restoration, no design change |
| 2026-07-23 | MINOR | Fix 🟡3 (markDone wiping catch-up schedule) on both platforms by using existing refreshOutcomes() instead of reload() | PM — restores intended behavior with existing API |
| 2026-07-23 | MINOR | Fix 🟡4 (cancelled reschedule persists past-dated plan) via a non-persisting dry-run plan path | PM — internal API detail, no stored-data-model change; cancel-must-not-mutate is intended behavior |
| 2026-07-23 | MINOR | Fix 🟡5 (weekly recurrence accepts empty daysOfWeek) with a validation rejection + test | PM — silent never-scheduling is a bug, not a feature |
| 2026-07-23 | MINOR | Fix 🟡6 (starved recurring goals absent from `unscheduled`) so recurring goals report starvation like one-offs | PM — silent starvation contradicts documented unscheduled semantics |
| 2026-07-23 | MINOR | Fix 🟢7 + QA-Q2 (rank→P-level collapse and duplicate labels, half-updated ranks on mid-loop failure) with a correct mapping + atomic update | PM — bug fix within approved priority feature |
| 2026-07-23 | MINOR | Fix 🟢9 (mobile flash() setTimeout unmount leak) and 🟢10 (handlers.ts route doc omits GET /outcomes) | PM — hygiene, behavior-preserving |
| 2026-07-23 | MINOR | 🟢8 (recurring goals with past deadline keep 3× urgency) — deferred, unreachable from UI; add a guard test only | PM — no user-visible impact; test documents the edge |
| 2026-07-23 | MINOR | QA-Q3 (Dashboard CTA conflation) — copy/label clarification only, no layout change | PM — minor UX polish within scope |
| 2026-07-23 | MINOR | Security: replace Math.random outcome-key with platform crypto; add `permissions: contents: read` to CI workflow | PM — hardening with no new dependencies or behavior change |
| 2026-07-23 | MINOR | Perf: dedup double outcomes/goals scans per plan call (behavior-preserving) + add perf regression test | PM — refactor + tests, both within PM authority |
