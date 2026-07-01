# Architecture

> Fill in this section — see comments below.

---

## System Overview

<!-- FILL IN: One paragraph describing the system at a high level. Who/what interacts with it? -->

## Component Map

<!-- FILL IN: List the major components and what each does. -->

```
[Component A]
    ↓
[Component B]   ←→   [External Service]
    ↓
[Component C]
```

## Layers

<!-- FILL IN: Describe the layers of the system (e.g., API → Agent Loop → Tools → Storage). -->

| Layer | Responsibility |
|-------|----------------|
| <!-- layer --> | <!-- responsibility --> |

## Data Flow

<!-- FILL IN: Walk through the main data flow from trigger to output. -->

1. Trigger: <!-- how does the agent start? (cron, webhook, user input, etc.) -->
2. <!-- step 2 -->
3. <!-- step 3 -->
4. Output: <!-- what does the agent produce? -->

## External Dependencies

<!-- FILL IN: APIs, services, databases the agent depends on. -->

| Dependency | Purpose | Failure Mode |
|------------|---------|--------------|
| <!-- name --> | <!-- what it does --> | <!-- what happens if it's down --> |

## Stack

> This project's concrete technology choices — captured at intake (greenfield) or **detected from the existing repo and treated as binding** (brownfield). The generic, every-project principles — model-naming, DB-driver placement, real-key testing — live in `harness/patterns/tech-stack.md`; this section is what **this** project actually uses. Python/FastAPI/Next.js is the harness's recommended *default* when a greenfield build has no stated preference — it is never assumed for a project that stated, or already has, a different stack.

- **Mode:** <!-- FILL IN: Greenfield (built from scratch by this harness) / Brownfield (extending an existing repo) -->
- **Language:** <!-- FILL IN: e.g., Python 3.12, Java 21, TypeScript -->
- **Agent framework:** <!-- FILL IN: e.g., LangGraph / custom / none -->
- **LLM provider + model:** <!-- FILL IN: e.g., Anthropic / claude-sonnet-4-6 -->
- **Backend:** <!-- FILL IN: e.g., FastAPI / Spring Boot / Express / none -->
- **Database + ORM:** <!-- FILL IN: e.g., PostgreSQL + SQLAlchemy 2.0 / none -->
- **Frontend:** <!-- FILL IN: e.g., Next.js / plain React + Vite / none -->
- **Dependency management:** <!-- FILL IN: e.g., uv + pyproject.toml / Maven / pnpm -->

## Commands

> The single binding source of truth for **which tool** every generator and gate actually runs — filled from the real detected toolchain (brownfield: read the lockfile/config that's already there — see `harness/patterns/tech-stack.md` → "Detection signals") or a sensible default (greenfield). Every other harness doc's command examples (`uv run`, `pytest`, etc.) illustrate the pattern, not a requirement — this table always wins.

| Command | Value |
|---------|-------|
| Package-manager run prefix | <!-- FILL IN: e.g., `uv run` / `pnpm` / `mvn` / (none) --> |
| Test command | <!-- FILL IN: e.g., `uv run pytest` / `mvn test` / `go test ./...` --> |
| Migration command | <!-- FILL IN: e.g., `uv run alembic upgrade head` / `flyway migrate` / N/A --> |
| E2E / UI test command | <!-- FILL IN: e.g., `npx playwright test` / N/A --> |
| Dev run command | <!-- FILL IN: e.g., `uv run python -m src` / `mvn spring-boot:run` --> |
| Dev port | <!-- FILL IN: e.g., 8001 --> |

| Key library | Version | Purpose |
|-------------|---------|---------|
| <!-- name --> | <!-- ver --> | <!-- purpose --> |

**Avoid:** <!-- FILL IN: libraries/patterns explicitly off-limits, and why -->

## Deployment Model

<!-- FILL IN: How does this run? (local script, cloud function, long-running service, etc.) -->
