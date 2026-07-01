# Tech-Stack Rules

Generic engineering **principles** that hold for **every** project, whatever stack is chosen. Each is stated as a stack-independent rule first; a labelled *Worked example* shows how it lands on the harness's default stack. The project's *actual* stack and — crucially — the exact commands that realise these principles are recorded in `spec/architecture.md` under `## Stack` and `## Commands`. **That per-project `## Commands` table is the single binding source of truth for which tool to run; the worked examples below are illustrations, never a requirement to use that specific tool.** This file is permanent doctrine; it is not edited per project.

**Recommended default (greenfield, no stated preference):** Python 3.12 + FastAPI + SQLAlchemy + Next.js. It is a recommendation for a brand-new build with no stack opinion — never assumed for a project that stated, or already has, a different stack.

---

## Stack Selection & Detection

- **Greenfield** — the stack comes from intake (a stated preference is a BINDING constraint). When intake is silent, use the recommended default above and document the choices as `> **Assumed:** ...` in `spec/architecture.md`.
- **Brownfield** — the stack is **whatever the existing repo already uses**, detected from the real files on disk and treated as binding (same status as a stated preference). Never impose a different toolchain on a repo that already has one.

### Detection signals

Read the lockfile/config that is already there — do not guess from file extensions alone. This list is representative, not exhaustive; the principle ("the toolchain is whatever the repo's own manifests declare") generalises to any ecosystem.

| Signal on disk | Toolchain |
|----------------|-----------|
| `uv.lock` | Python + uv |
| `poetry.lock` | Python + poetry |
| `Pipfile` | Python + pipenv |
| `requirements.txt` (no lock above) | Python + pip/venv |
| `pnpm-lock.yaml` | Node + pnpm |
| `yarn.lock` | Node + yarn |
| `package-lock.json` | Node + npm |
| `pom.xml` | Java + Maven |
| `build.gradle` / `build.gradle.kts` | Java/Kotlin + Gradle |
| `go.mod` | Go modules |
| `Cargo.lock` | Rust + cargo |
| `Gemfile.lock` | Ruby + bundler |
| `composer.json` | PHP + composer |

| Concern | How to detect |
|---------|---------------|
| Migrations | `alembic/`→Alembic · Django `*/migrations/`→Django ORM · `prisma/`→Prisma · `db/migrate/`→Rails/ActiveRecord · `flyway*`/`src/main/resources/db/migration`→Flyway · `liquibase*`→Liquibase |
| E2E / UI tests | `playwright.config.*`→Playwright · `cypress.config.*`→Cypress · `*.feature`→Cucumber |
| Web server / entrypoint | Read the declared entrypoint — `Procfile`, `Dockerfile CMD`, `main`/`scripts.start` in the manifest, `@SpringBootApplication` class — and record the command it actually invokes (e.g. which of `gunicorn`/`uvicorn` the Procfile runs) |
| Test runner | The manifest's declared test script/plugin — `pytest`/`unittest`, `jest`/`vitest`/`bun test`, `mvn test`/`gradle test`, `go test` |

Record the resolved commands in `spec/architecture.md` → `## Commands`. From then on, every agent and gate reads that table — not this file's examples.

---

## Default Dev Port Principle

Pick a default dev port that is **unlikely to collide** with a service the user already runs, and make it env-overridable. Port 8000 is commonly occupied (FastAPI, Django, `http.server`), so avoid it as a default.

- Brownfield: keep the port the existing app already uses — do not change it.
- The dev port lives in `## Commands` (Dev port) and the README must reference it consistently.

*Worked example — Python/FastAPI:* default to **8001**; `__main__.py` hard-codes `port=8001` unless an env var overrides; `.env.example` includes `PORT=8001` if configurable; the README references `http://localhost:8001`.

## Frontend Build & Styling Principle

Any project with a frontend must satisfy three things, however the specific framework realises them:

- **Test the deployed run path, not a dev-only convenience path.** Whatever the production serving model is (static export served by the backend, a standalone SPA, SSR), the gate and the user test that exact path and URL — not a separate dev server on a different origin that would 404 or hit a different API origin in production.
- **Verify styling actually built, not just that a page returned 200.** A build exiting 0 does not prove CSS/JS loaded. The gate greps the built asset bundle for real style output and asserts no unprocessed directives survive.
- **Headless E2E is required for any project with a frontend.** Include an E2E suite that drives the live app and asserts the primary journey renders, is interactive, and shows real output — not just that the page loads. The exact runner is in `## Commands` (E2E / UI test command). A frontend gate that only checks HTTP 200 or greps CSS is not a gate — the E2E suite must also pass.

*Worked example — Next.js static export + Playwright:*
- The frontend is a static export served by the backend (`output: 'export'`, `basePath: '/app'`, mounted by FastAPI at `/app`). Single-origin is the canonical run + test path: `cd frontend && pnpm build` → `uv run python -m src`, then open `http://localhost:8001/app/` (note the port, the `/app/`, and the trailing slash). Do **not** hand the user the two-server `pnpm dev` (`:3000`) flow — with `basePath: '/app'`, `localhost:3000/` 404s and the API origin differs. `pnpm dev` is for inner-loop dev only.
- Tailwind v4 requires `postcss.config.mjs` (plugin: `@tailwindcss/postcss`) and `@source "../";` in the global CSS. Without both, the built CSS has no utility classes — unstyled even though the build exits 0. Never replace or omit these two files; extend `globals.css` below the `@source` line. The gate greps the built CSS for real utility selectors.
- Node ≥25 exposes a broken global `localStorage` unless `--localstorage-file` is set, crashing Next SSR (`localStorage.getItem is not a function` → every page 500s). Carry `NODE_OPTIONS=--no-experimental-webstorage` in the `dev`/`build`/`start` scripts, or pin a supported Node LTS via `.nvmrc`/`engines`.
- Install Playwright (`pnpm add -D @playwright/test && npx playwright install --with-deps chromium`); `tests/e2e/` smoke covers page-loads-and-is-styled, primary input works, real output appears. Gate: `npx playwright test tests/e2e/ --reporter=line`.

## LLM Model Name Rule

**Always use a current, verified model name — never a deprecated or guessed one.** (Stack-independent.)

- Model names change. Before hardcoding any model identifier, verify it exists by calling the provider's `ListModels` API or checking current documentation.
- The model name must be configurable via an env var (e.g. `APPNAME_LLM_MODEL`) so it can be changed without a code deployment.
- A 404 NOT_FOUND from the LLM API almost always means the model name is wrong — check the name first before debugging anything else.

Current safe defaults (as of 2026):

| Provider | Default model | Notes |
|----------|---------------|-------|
| Anthropic | `claude-sonnet-4-6` | matches `.env.example`; verify against current docs before pinning |
| OpenRouter | `anthropic/claude-sonnet-4-6` | provider-prefixed; routes to the underlying model |
| Google Gemini | `gemini-3.1-pro` | default; `gemini-2.5-flash` is the fast/cheap alternative for latency-sensitive nodes. `gemini-2.0-flash`/`gemini-1.5-flash` are unavailable for new users |
| OpenAI | `gpt-4o-mini` | |

## DB Driver / Runtime-Dependency Placement Principle

Any dependency needed at **deploy/setup or migration time** (not just in tests) must be declared as a **main runtime dependency**, never in a dev-only group. Migrations run outside the test environment; a migration tool or DB driver hidden in a dev group fails in any environment that didn't install dev deps.

*Worked example — Python:* the DB driver (`psycopg2-binary` / `asyncpg` for PostgreSQL) goes in `[project.dependencies]`, never in `[dependency-groups.dev]`, so `alembic upgrade head` works at deploy time.

## Test Environment Principle — Same Data Store as Production

**Tests run against the same database engine as production.** If production is PostgreSQL, tests use PostgreSQL — not SQLite or any lighter substitute. A suite that only passes on a substitute engine tells you nothing about whether the real migrations and queries work.

- Test setup/teardown is **automated** (no manual steps) via the ecosystem's standard mechanism, and runnable with the single Test command in `## Commands`.
- Use a dedicated, isolated test database (e.g. `myapp_test`), never the dev or prod database.
- The test DB URL is provided via env var (reuse the app's config mechanism, or a `TEST_DATABASE_URL`). The README documents it.

*Worked example — PostgreSQL + SQLAlchemy (sync), `conftest.py`:*

```python
import pytest
from sqlalchemy import create_engine
from yourapp.db.models import Base
from yourapp.config.settings import get_settings

@pytest.fixture(scope="session", autouse=True)
def _setup_test_db():
    settings = get_settings()
    engine = create_engine(settings.database_url)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
    engine.dispose()
```

The `DATABASE_URL` in `.env` (or `.env.test`) must point at a real PostgreSQL test database before running tests.

## LLM / API Test Rule

**Tests and evals run against the real LLM/API using keys loaded from `.env`.** (Stack-independent.) There is no offline-passing requirement; real-key execution is the default and required path for every gate, against the production database engine (never a lighter substitute). A stub provider MAY exist as an optional local fallback when a key is genuinely absent, but it is never the gate. The quality bar is perfect, zero errors — edge-case, end-to-end, and UI tests are required, not optional.

- The build and tests load keys programmatically from `.env` (gitignored); confirm a key by presence (bool) only — never echo, print, paste, or commit a secret value.
- A stub is permitted only for an integration whose external system isn't built yet — never as a substitute for the real provider on a path that exists.
- **CI contract:** a runner without secrets cannot pass the real-key gate. Either inject the keys from a secret store, or skip the real-key tests when keys are unset (using the ecosystem's skip mechanism). Skipped is not passed: the Phase 2+ gate is BLOCKED if a required key is missing locally.
