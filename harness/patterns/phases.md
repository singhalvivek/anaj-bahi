# Implementation Phases

Agents are built phase by phase, derived from the user's requirements — not a fixed ladder. **Phase 1 is the smallest user-testable win that works first time;** each later phase wires a stub into a real feature. Production concerns trail behind the requirements.

## Core Principle

**Smallest win first, then complete, then polish.**

Phase 1 is the SMALLEST user-testable win that works the FIRST time the user tests it — real on the one core path, with clearly-labelled stubs for everything else (this is the same rule the spec-writer applies; the two must agree). It is fine for Phase 1 to be smaller than "complete" — what matters is that the one path it delivers is real and impresses, not that it covers every requirement. Later phases wire the labelled stubs into real features, one human-tested increment at a time. Do NOT over-scope Phase 1 to cover "all the primary requirements" — that is the over-build that doubles build time and breaks first-time-right.

The spec-writer derives the phase breakdown from `spec/roadmap.md` — the count and names come from the requirements, not a fixed ladder.

## Phase Structure

Four roles are always present; the middle phases are derived from requirements:

---

### Phase 1 — First Win

Phase 1 is the **smallest user-testable win** — the full primary user journey end-to-end, real and working the first time, that the person who briefed the idea immediately appreciates. Not every feature: the complete primary flow, done right, with supporting features as labelled stubs.

- **Full primary journey, not "all the features."** Deliver the complete end-to-end flow that proves the idea (e.g. upload → profile → ask → answer-with-chart) — every step the user must take to get a real result. Defer secondary features (export, history, multi-file, settings) to later phases as clearly-labelled stubs. Over-scoping Phase 1 to cover every feature is the failure mode, not the goal.
- **Agentic stack is wired from day one.** The graph framework (LangGraph or equivalent), state type, core nodes, and assembly are set up in Phase 1 even if some capability nodes are stubs. Never defer the agentic skeleton.
- Frontend is visually complete: real UI for the one path Phase 1 delivers, PLUS clearly-labelled stubs for what's coming. Stubs are never mistaken for bugs.
- All calls on the tested path hit the real LLM/API (keys from `.env`) — no fake data on what the user tests.
- **Gate (all must pass):** *(commands are illustrative — use this project's `## Commands` values)*
  1. The runtime dependency needed for migrations/DB access is declared as a **main** dependency, never dev-only (e.g. `pyproject.toml` puts `psycopg2-binary` in `[project.dependencies]`) — so the migration command works at deploy time
  2. The **migration command** (from `## Commands`, e.g. `uv run alembic upgrade head`) succeeds against the configured database — run and confirmed, not assumed. N/A if the project has no database
  3. **Boots via the documented run command** — the app starts on its exact `## Commands` "Dev run command" from the project root (e.g. `uv run python -m src`, `mvn spring-boot:run`) with no import/module/startup error. A green test run does NOT prove this (test runners often put `.` on the path, masking run-path import bugs); the test path must equal the run path.
  4. Primary user journey works end-to-end against the real LLM/API; tests pass
  5. **Agentic stack gate:** graph compiles, state flows through nodes, agent is invocable — confirmed by the Phase 1 test
  6. **Styled-render (any built-asset UI):** after the frontend build, the served page at the deployed run path is rendered AND styled — the built asset bundle contains real style output and no unprocessed directives remain. An unstyled 200 fails the gate. *(Worked example — Next.js static export: `pnpm build`, served at `:8001/app/`, CSS bundle has real utility selectors, no unexpanded `@tailwind`/`@source`.)*
  7. **Headless E2E (any project with a frontend):** the E2E suite (from `## Commands`, e.g. Playwright) runs against the live app at its deployed URL and asserts the primary user journey renders correctly, is interactive, and shows real output — not just a 200. A CSS-grep pass without an E2E pass is not sufficient.
  8. **Observability wired:** LangSmith tracing enabled (LangGraph builds) and/or structured request/response logging to stdout confirmed working — a log line or trace appears for the Phase 1 end-to-end run. Observability is never deferred.
  9. Working tree is clean and committed
  10. Phase test-handoff published; the human has tested and approved (see Human Testing Gate)

---

### Phases 2–N — Requirements Phases *(spec-writer derives these)*

Each phase covers a chunk of remaining user requirements from `spec/roadmap.md`. The spec-writer **names these phases after what they deliver**, not after generic production concerns. Aim for all user requirements covered by phase 2–3 — fewer, bigger phases beat many thin ones.

- Each phase wires Phase-1 stubs into real functionality — a **minimum of 3 capabilities per phase**. Never deliver a single capability in isolation; group related capabilities that form a coherent user story and build them together. A phase with fewer than 3 capabilities is too thin — collapse it into the adjacent phase.
- All external calls hit the real provider using keys from `.env`; tests assert on real responses (shape/content), not hardcoded strings.
- **Gate:** The phase's user-testable increment works end-to-end against the real LLM/API; tests pass; working tree clean; human approved.

---

### Phase N+1 — Agentic Stack Upgrade + Resilience *(only if `spec/agent.md` calls for patterns beyond the base loop)*

If the spec's agent graph needs more than the base ReAct loop, add a phase to upgrade the agentic architecture and harden external calls. A simple single-loop agent that already meets its requirements does not need this phase — do not add it by default.

- **Upgrade the agentic stack** per `spec/agent.md`: wire in the patterns it calls for beyond the base ReAct loop — planning, reflection, multi-agent coordination, memory, or whatever the spec requires. Phase 1 laid the skeleton; this phase promotes it to the production-grade architecture.
- Add error handling to all external calls: try/except, retries, timeouts. Agent continues (degraded, not crashed) on non-critical failures.
- **Gate (all must pass):**
  1. Every pattern listed in `spec/agent.md` beyond the base loop is wired and exercised by a real test
  2. Agent handles all documented failure modes without crashing

---

### Phase N+2 — Complete Agentic System *(the final requirements phase — every capability real)*

The last phase turns the remaining labelled stubs into real features so every capability in `spec/roadmap.md` is active and the system runs fully end-to-end. (When the agent is simple, this is just the last requirements phase — not a separate agentic milestone.)

- Every capability in `spec/roadmap.md` is real — no stubs on any active path.
- Complete any remaining integrations; system runs against all real services.
- **Gate (all must pass):**
  1. All integrations are real; agent runs fully end-to-end against the real LLM/API
  2. Every capability in the spec is implemented and tested with real data
  3. `spec/agent.md` graph matches the running code — drift audit passes on the agentic surfaces

---

### Trailing Phases *(only if the spec requires them)*

These phases exist only when the spec explicitly calls for them — never as defaults:

- **API / CLI Surface** — only if `spec/api.md` calls for an external API or CLI
- **UI Polish** — only if `spec/ui.md` calls for further UI work beyond Phase 1
- **Advanced Observability** — dashboards, metrics, alerting beyond the basic LangSmith tracing + structured logging already wired in Phase 1
- **Polish + Hand-off** — final drift audit; README verified end-to-end from a clean clone; user accepts hand-off

---

## Human Testing Gate

The build is autonomous WITHIN a phase, with a human testing gate BETWEEN phases — at EVERY phase boundary.

After a phase passes its automated gate and is committed, the build publishes a **test-handoff** and STOPS:
- The handoff gives exact run commands, what to click/look at, the expected result, and what is a labelled stub vs. real.
- Only the root session presents it and asks the human.
- The next phase starts ONLY after the human approves.
- On a reported issue → qa-auditor diagnoses and routes → the right generator (frontend and/or backend) fixes → re-gate → re-present.

## Parallel Slices Within a Phase

- spec-writer carves each phase into INDEPENDENT SLICES (the parallel units) with explicit dependencies; default to independence so slices build concurrently.
- agent-builder fans out a generator per slice — multiple code-generator invocations in a SINGLE message so they run concurrently (disjoint paths: frontend writes the frontend surface, backend writes `src/` — never the same file). Then fans out qa-auditor per slice concurrently and aggregates verdicts.
- Serialize ONLY across a true declared dependency. On a BLOCKED slice, loop only that slice's generator; other slices are unaffected. For headless/CLI builds, only backend generators run.

## Phase Gates

A phase is complete when ALL of the following are true:
1. All code for the phase is committed and pushed
2. All tests for the phase pass
3. Working tree is clean
4. Phase test-handoff published; (build) human tested and approved
5. qa-auditor sub-agent (or manual QA checklist) has signed off
6. For Phase 1 specifically (projects with a database): the migration command (from `## Commands`, e.g. `alembic upgrade head`) has been run against the real DB and succeeded
7. **README updated** — every command, env var, setup step, route, or capability this phase added is reflected in `README.md`, and every README command in scope has been run and confirmed to work from the stated directory. A stale README is a BLOCKER.

**Never mark a phase complete if any gate is red.**

**Never claim a phase passes based on tests alone if those tests use a different database engine than production.** Tests passing on a lighter substitute engine do not mean the production migrations/queries work.

**Never claim Phase 2+ passes on stubbed providers** — the gate runs against the real LLM/API with keys from `.env`.

## Phase Tracking

The current phase is recorded in git commit messages (`phase-N: [description]`). To see phase history, run `git log --oneline | grep "phase-"`.

## Adapting the Phases

The spec-writer derives the phases from `spec/roadmap.md`. What is fixed:

- **Phase 1 is always the smallest user-testable win** — the one core path real and first-time-right, the rest as labelled stubs (this matches `spec-writer.md` exactly; the two never disagree)
- **The agentic stack is always wired in Phase 1** — graph, state, nodes, assembly; never deferred (the skeleton is wired even though most nodes start as stubs)
- **An Agentic Stack Upgrade phase and a Complete Agentic System phase are added only when `spec/agent.md` calls for patterns beyond the base loop** — a simple agent that meets its requirements does not get them by default
- **Trailing phases are only added when the spec explicitly requires them**

What varies (derived from requirements):
- How many requirements phases (2–N) — count comes from `spec/roadmap.md`; target 1–2 requirements phases. Each must contain at least 3 capabilities — if a phase would have fewer, collapse it into the adjacent one.
- Names of requirements phases — named after what they deliver (e.g. "Profiling + Charts + Export", "History + Multi-file + Settings"), not generic concerns

---

## Gate Commands (illustrative — the real one lives in `## Commands`)

The exact gate command for **this** project is set by spec-writer in `spec/roadmap.md` (`## Phases of Development`) and mirrors `spec/architecture.md` → `## Commands` (Test / Migration / E2E commands). The table below is illustrative of the *shape* per ecosystem — pick and adapt to the project's actual detected/chosen toolchain, never assume a row applies.

| Language | Phase 1 gate (illustrative) | Phase 2+ gate (illustrative) |
|----------|-------------|-------------|
| Python + uv | `uv run alembic upgrade head` + `uv run pytest` | `uv run pytest` (PostgreSQL, automated via conftest) |
| TypeScript (Bun) | migration tool + `bun test tests/unit/` | `bun test tests/integration/` |
| TypeScript (Node) | migration tool + `npx vitest run tests/unit/` | `npx vitest run tests/integration/` |
| Java (Maven) | `flyway migrate` (or `mvn flyway:migrate`) + `mvn test` | `mvn verify` |
| Go | `migrate up` + `go test ./internal/...` | `go test ./...` |

Phase 2+ gates run with **real LLM/API keys loaded from `.env`** regardless of language; both the DB URL and the provider key(s) must be set.

## TypeScript/Bun Integration Test Pattern

```typescript
// tests/integration/pipeline.test.ts
import { describe, it, expect, beforeEach } from "bun:test";

// Use the production DB driver via conftest-style setup/teardown — never SQLite-as-a-substitute
// Call the real LLM/API using keys from .env

describe("pipeline", () => {
  it("runs end-to-end against the real provider", async () => {
    // call runner against the real provider
    // assert DB record created with correct status
  });
});
```
