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
