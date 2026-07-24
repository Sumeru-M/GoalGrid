# GoalGrid — Session State & Resume Guide

> Purpose: everything needed to continue development without prior conversation
> context. Read with `CLAUDE.md` (governance) and `docs/DECISIONS.md` (decisions).
> Updated: 2026-07-23.

## Current state — everything below is DONE and verified

| Component | State |
|---|---|
| Engine `src/` | Scheduler + hierarchical learning + trained priors (declared→learned→trained→neutral); reschedule injects one-off catch-up goals; minSession floors at goal minutes. 19 tests. |
| Trained model | `training/generate_data.py` (600k rows, seeded) → `train.py` (11/11 norm checks, gender gap 0.003, shrinkage K=50) → `src/model/trained-priors.json`. CSV gitignored/regenerable. |
| Backend `backend/` | KVStore seam → safeParse'd repositories (unique outcome keys) → PlannerService (date-scoped completions) → validated router/handlers. 24 tests. Node server = dev only, 1 MB cap. |
| Web `frontend/` | React 18 + Vite, monochrome, numeric P1–P5, all 7 screens, error states. Dev server :5178 via `.claude/launch.json`. |
| Mobile `apps/mobile/` | Expo SDK 57 (current latest stable — do NOT downgrade; Expo Go tracks latest), expo-dev-client installed, all 7 screens, `expo-doctor` 20/20. Shared core via `scripts/link-core.sh` (postinstall). Web target `npm run web` :8081. **Native iOS validated on simulator** (Release build via `npx expo run:ios`; Setup→plan, featured-card contrast, modal safe-area all confirmed). |
| CI | `.github/workflows/ci.yml`: verify job (root tsc+43 tests+frontend tsc) + parallel mobile job (npm ci→tsc). |
| Governance | 11 role subagents + verify/reviewer/trainer ops agents in `.claude/agents/`; PM-gated protocol in `CLAUDE.md`; protocol dry-run passed (PM caught a stale-git-status flag). |

Gates: `npm test` = **43/43**; `tsc --noEmit` clean at root, `frontend/`, `apps/mobile/`.

## Environment facts (this Mac — hard-won, don't rediscover)
- `xcode-select` fixed to `/Applications/Xcode.app`; **iOS 26.5 simulator runtime installed**; iPhone 17 sim udid `9A7BDE89-9600-4057-8DC0-05CFDC7BE0D7`.
- CocoaPods 1.17.0 via Homebrew — **needs `LANG=en_US.UTF-8`** or it crashes (Encoding::CompatibilityError).
- Native builds: use **`npx expo run:ios --configuration Release`** (raw headless xcodebuild breaks: React codegen's node runs with cwd at the node binary → "Cannot find module @react-native/codegen").
- Generated `apps/mobile/ios|android` are CNG artifacts — gitignored; `app.json` is source of truth; regenerate via `npx expo prebuild`.
- Metro can't resolve paths above the app root — shared core resolves as linked packages `goalgrid-core`/`goalgrid-backend` (restored by postinstall after every install).
- Verification gotchas: stale Metro bundle → `expo start --clear`; console errors may be stale HMR → confirm in a fresh browser tab.

## Open items
- **Owner-only:** EAS builds (`eas build`, needs Expo login) and store submission (Apple/Google accounts). Commands in `apps/mobile/README.md`.
- **Deferred by decision** (need a driver + owner approval): npm-workspaces conversion; shared `goalgrid-client` package (client logic `format`/`api`/`useAppData` is deliberately mirrored web↔mobile — changes must be applied to BOTH).
- Uncommitted: `docs/DECISIONS.md` (PM log entries) + this file — fold into next owner commit.

## How to resume (any session)
1. `CLAUDE.md` governs: route work to role subagents → reports to `product-manager` → MAJOR items reach the owner ONLY as selectable questions. Commits are owner-performed.
2. Before claiming anything done: run the gates above (or the `verify` agent) and drive the affected surface.
3. Context discipline: delegate heavy work to subagents (isolated context), keep tool output lean, screenshot only when it proves something.
