# Deploying Anaj Bahi

Anaj Bahi has two independently deployable pieces:

- **Frontend PWA** — a static export served from **GitHub Pages**. Fully offline-capable; the backend is optional.
- **Sync backend** — a small FastAPI + SQLite service on **PythonAnywhere** (free, no card) for optional cloud backup/restore.

The app works **fully offline without the backend**. You only need the backend if you want cloud backup across devices.

---

## Base path (`NEXT_PUBLIC_BASE_PATH`)

The static export is served under a URL sub-path (`basePath`). It is parameterized by the `NEXT_PUBLIC_BASE_PATH` env var:

| Context | `NEXT_PUBLIC_BASE_PATH` | basePath | Notes |
|---------|-------------------------|----------|-------|
| Local dev / `pnpm build` / E2E | unset (defaults to `/app`) | `/app` | Do not set the env var. Playwright uses `http://localhost:3000/app/`. |
| GitHub Pages production | `/anaj-bahi` | `/anaj-bahi` | Set by the CI workflow. Repo name = sub-path. |

The CI workflow sets the env var; you only set it locally if you want to reproduce the production build (see below).

---

## Frontend → GitHub Pages

The production URL is **`https://singhalvivek.github.io/anaj-bahi/`** and the production basePath is **`/anaj-bahi`** (the repo name).

1. **Create the repo** named exactly `anaj-bahi` under your account and push this project to it:
   ```sh
   git remote add origin https://github.com/singhalvivek/anaj-bahi.git
   git push -u origin main
   ```
2. **Enable Pages:** repo **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. **Deploy:** the workflow `.github/workflows/deploy-pages.yml` runs automatically on every push to `main`. To run it manually, use **Actions → Deploy PWA to GitHub Pages → Run workflow** (`workflow_dispatch`).
4. **Open** `https://singhalvivek.github.io/anaj-bahi/` and, on Android Chrome, **Add to Home screen** to install the PWA.

### Reproduce the production build locally (optional)

```sh
cd frontend
NEXT_PUBLIC_BASE_PATH=/anaj-bahi pnpm build:pages
```

`build:pages` runs `next build` and then `scripts/apply-base-path.mjs`, which rewrites the `/app` literals in the exported `out/manifest.webmanifest` and `out/sw.js` to `/anaj-bahi`. With the env var unset (or `/app`) the rewrite is a no-op and the default `pnpm build` is unchanged.

> On Windows PowerShell, set the env var inline differently:
> ```powershell
> $env:NEXT_PUBLIC_BASE_PATH="/anaj-bahi"; pnpm build:pages; Remove-Item Env:\NEXT_PUBLIC_BASE_PATH
> ```

---

## Backend → PythonAnywhere (free, no card)

PythonAnywhere's free "Beginner" plan needs **no credit card**, gives a **persistent home disk** (so the SQLite file survives), and serves **HTTPS**. Its web apps are **WSGI**, so the FastAPI (ASGI) app runs through the WSGI adapter in `backend/wsgi.py`, which drives the app with a **fresh event loop per request** (a shared-loop wrapper like `a2wsgi` deadlocks under PythonAnywhere's uWSGI after the first request).

Replace `<user>` with your PythonAnywhere username and `<token>` with a long random string (the same one you enter in the app).

1. **Sign up** at pythonanywhere.com (Beginner plan — free, no card).
2. Open **Consoles → Bash**, then clone the app repo and install deps in a virtualenv:
   ```sh
   git clone https://github.com/singhalvivek/anaj-bahi.git
   cd anaj-bahi/backend
   mkvirtualenv --python=/usr/bin/python3.11 anaj
   pip install fastapi sqlalchemy pydantic-settings
   ```
   (Any Python ≥ 3.11 that PythonAnywhere offers is fine; `uvicorn` is not needed under WSGI.)
3. **Create the SQLite tables** on the persistent disk (run once):
   ```sh
   export DATABASE_URL="sqlite:////home/<user>/anaj-bahi/backend/data/anaj.db"
   export DEVICE_TOKEN="<token>"
   python -m app.init_db
   ```
4. **Web → Add a new web app → Manual configuration** (NOT "Flask") → pick the **same Python version** as the virtualenv (3.11).
5. On the web-app config page set:
   - **Source code:** `/home/<user>/anaj-bahi/backend`
   - **Working directory:** `/home/<user>/anaj-bahi/backend`
   - **Virtualenv:** `/home/<user>/.virtualenvs/anaj`
6. Click the **WSGI configuration file** link, delete everything in it, and paste:
   ```python
   import os, sys
   path = "/home/<user>/anaj-bahi/backend"
   if path not in sys.path:
       sys.path.insert(0, path)
   os.environ["DATABASE_URL"] = "sqlite:////home/<user>/anaj-bahi/backend/data/anaj.db"
   os.environ["DEVICE_TOKEN"] = "<token>"
   from wsgi import application  # noqa: E402
   ```
7. Click the green **Reload** button.
8. **Verify:** open `https://<user>.pythonanywhere.com/health` → `{"status":"ok"}`.

**Updating later:** in a Bash console, `cd ~/anaj-bahi && git pull`, then **Reload** the web app. **Renewal:** free web apps must be renewed every ~3 months (PythonAnywhere emails a one-click link).

### Point the app at the backend

In the PWA: **Settings → Cloud backup**:

- **Backend URL:** the backend's **HTTPS** URL — `https://<user>.pythonanywhere.com`. HTTPS only — an HTTP URL is blocked by the browser as mixed content.
- **Device token:** the **same** `DEVICE_TOKEN` you set in the PythonAnywhere WSGI file.

These are stored locally on the device (Dexie `meta`), not baked into the build, so no rebuild is needed to point at a backend. The app keeps working fully offline; sync flushes opportunistically when online.

---

## Notes

- `DATABASE_URL` uses **four** slashes for an absolute path (e.g. `sqlite:////home/<user>/anaj-bahi/backend/data/anaj.db`) so the SQLite file lives on PythonAnywhere's persistent home disk. A three-slash relative URL is relative to the process working directory instead.
- The backend enables permissive CORS (`allow_origins=["*"]`); auth is a Bearer device token (no cookies), so a wildcard origin is safe.
- The frontend is a pure static export — it needs no server and can also be hosted on any static host under any sub-path by setting `NEXT_PUBLIC_BASE_PATH` accordingly.
