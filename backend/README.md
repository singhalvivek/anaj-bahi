# Anaj Bahi — Sync Backend (FastAPI + SQLite)

Personal cloud backup/restore service for the Anaj Bahi PWA. Single-user,
low-concurrency, backed by one local SQLite file. **No AI/LLM** — a plain sync API.

The device's IndexedDB store stays the source of truth; this backend is backup + restore.

## Prerequisites

- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)

## Configure

Copy the example env and set a long random device token (the PWA Settings screen
uses the **same** token):

```sh
cp .env.example .env
# edit .env: set DEVICE_TOKEN to a long random string
```

`backend/.env` is gitignored — never commit a real token. Keys:

- `DATABASE_URL` — SQLite file location (default `sqlite:///./data/anaj.db`).
- `DEVICE_TOKEN` — bearer token required on every `/sync/*` call. The API refuses
  to start if it is unset.

## Install

```sh
uv sync
```

## Initialise the database

Creates the SQLite file + tables (idempotent — safe to re-run):

```sh
uv run python -m app.init_db
```

## Run

```sh
uv run uvicorn app.main:app --port 8000
```

- Health (no auth): `GET http://localhost:8000/health` → `{"status":"ok"}`
- The API also runs `create_all` on startup, so a fresh run works without the
  init step; `init_db` remains available for an explicit setup/deploy step.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | liveness check |
| POST | `/sync/push` | `Authorization: Bearer <DEVICE_TOKEN>` | upsert bills/farmers/grain types/profile |
| GET | `/sync/pull` | `Authorization: Bearer <DEVICE_TOKEN>` | full snapshot for restore |

Merge rules: bills are **last-write-wins by `updatedAt`**; farmers/grain types are
upsert-by-id (last push wins); profile is a singleton (latest wins; `null` is a
no-op). Push is idempotent — re-pushing the same payload changes nothing.

## Test

```sh
uv run pytest
```

Tests run against a real on-disk temp SQLite file per test (not `:memory:`).
