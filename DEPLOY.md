# Deploying Anaj Bahi

Anaj Bahi has two independently deployable pieces:

- **Frontend PWA** — a static export served from **GitHub Pages**. Fully offline-capable; the backend is optional.
- **Sync backend** — a small FastAPI + SQLite service on **Fly.io** for optional cloud backup/restore.

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

## Backend → Fly.io

The backend is FastAPI + SQLite. The SQLite file lives on a **persistent Fly volume** mounted at `/data`, so data survives restarts and redeploys.

From the `backend/` directory:

1. **Launch** (uses the provided `fly.toml` — do not overwrite it, and do not deploy yet):
   ```sh
   cd backend
   fly launch --no-deploy
   ```
   Keep/confirm the app name and the `[mounts]`/`[env]` from `fly.toml`.
2. **Create the persistent volume** (name must match `fly.toml` `[mounts].source`):
   ```sh
   fly volumes create anaj_data --size 1
   ```
3. **Set the device token secret** (a long random string — the same one you enter in the app):
   ```sh
   fly secrets set DEVICE_TOKEN=$(openssl rand -hex 24)
   ```
   `DEVICE_TOKEN` is a secret and is **never** committed to `fly.toml` or the repo.
4. **Deploy:**
   ```sh
   fly deploy
   ```
   The container runs `python -m app.init_db` (creates the SQLite tables on the volume, idempotent) and then serves `uvicorn app.main:app` on port **8080**. Fly exposes it as HTTPS.
5. **Verify:** `https://<your-app>.fly.dev/health` returns `{"status":"ok"}`.

### Point the app at the backend

In the PWA: **Settings → Cloud backup**:

- **Backend URL:** the Fly **HTTPS** URL, e.g. `https://anaj-bahi-sync.fly.dev` (HTTPS only — an HTTP URL will be blocked by the browser as mixed content).
- **Device token:** the **same** value you set via `fly secrets set DEVICE_TOKEN=...`.

These are stored locally on the device (Dexie `meta`), not baked into the build, so no rebuild is needed to point at a backend. The app keeps working fully offline; sync flushes opportunistically when online.

---

## Notes

- `DATABASE_URL` in `fly.toml` is `sqlite:////data/anaj.db` — **four** slashes = the absolute path `/data/anaj.db` on the mounted volume. A three-slash relative URL would write to the machine's ephemeral disk and be lost on redeploy.
- The backend enables permissive CORS (`allow_origins=["*"]`); auth is a Bearer device token (no cookies), so a wildcard origin is safe.
- The frontend is a pure static export — it needs no server and can also be hosted on any static host under any sub-path by setting `NEXT_PUBLIC_BASE_PATH` accordingly.
