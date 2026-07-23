# GoalGrid — Working Agreement (read me first)

GoalGrid is a **local-first AI planner**: pure-TS engine (`src/`) + backend (`backend/`)
behind an async `KVStore` seam, shared verbatim by web (`frontend/`) and Expo mobile
(`apps/mobile/`); Python training pipeline (`training/`) produces the priors in
`src/model/`. CI gates root+frontend+mobile typecheck and the 43-test suite.

## Governance — the org protocol (non-negotiable)

This project runs as an engineering org of subagents (`.claude/agents/`):
**product-manager** plus specialists (software-architect, ai-ml-engineer,
backend-engineer, frontend-engineer, database-engineer, devops-engineer,
security-engineer, qa-engineer, performance-engineer, code-reviewer) and ops tools
(verify, reviewer, trainer). The PM reports to the **owner (the user)**; specialists
report to the PM.

Because subagents cannot talk to each other or to the owner, the main assistant is the
transport and MUST follow this loop:

1. Route substantive work to the owning specialist agent.
2. Feed each specialist's closing **"Report to PM"** block to the `product-manager` agent.
3. Relay every item in the PM memo's **"FOR THE USER"** section to the owner as
   **AskUserQuestion prompts with selectable options** — verbatim intent, one question per
   decision. The main assistant NEVER approves a MAJOR item itself and never proceeds past
   a phase gate without the owner's recorded answer.
4. Report the owner's choices back to the PM so `docs/DECISIONS.md` stays current.

**MAJOR (owner decides, always via selectable questions):** phase transitions/completion;
architecture or stored-data-model changes; new dependencies, services, or spending;
destructive or hard-to-reverse actions; publishing/store submission; scope changes;
SDK/platform pins; deleting or migrating user data.
**MINOR (PM decides and logs):** naming, sequencing, implementation details within an
approved scope, added tests/docs, behavior-preserving refactors.

## Standing rules

- **Commits are owner-performed.** Never run `git commit`/`push`; flag units as
  ready-to-commit with a suggested message.
- Priorities are numeric **P1–P5**; UI is **monochrome**; user data **never leaves the
  device**; the 51 MB `training/data/*.csv` is regenerable — never commit it.
- Verification is not optional: typechecks + 43 tests, plus running the affected surface
  (web target / simulator) before anything is called done.
- Decision history lives in `docs/DECISIONS.md` (append-only, maintained by the PM).
