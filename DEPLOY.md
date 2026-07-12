# Deploying Anaj Bahi

Anaj Bahi is a single deployable piece:

- **Frontend PWA** — a static export served from **GitHub Pages**. Fully offline-capable (local-first).

There is **no self-hosted backend to deploy**. Identity and data are hosted **Firebase** — Phone
Authentication (SMS-OTP) + Cloud Firestore with offline persistence — configured entirely from the
frontend build (see [Firebase](#firebase-auth--data) below). Writes work offline and sync
automatically to the shared business ledger when signal returns.

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

## Firebase (auth + data)

Identity and data are hosted Firebase — nothing to deploy on a server, but the project must be
configured and its config baked into the production build.

1. **Create a Firebase project** and enable **Authentication → Phone** and **Cloud Firestore**.
2. **Web config:** add a Web app and provide its 6 `NEXT_PUBLIC_FIREBASE_*` values to the
   production build. These are **public web config** (build-time inlined), not secrets — access
   control is the Firestore Security Rules. For GitHub Pages, add them as repo **Actions secrets**
   consumed by `.github/workflows/deploy-pages.yml`; for a local production build, set them in
   `frontend/.env.local`.
3. **Security Rules:** publish [`firestore.rules`](firestore.rules) to the project
   (Firebase console → Firestore → Rules, or `firebase deploy --only firestore:rules`). These
   enforce the real boundaries — a shared per-business ledger, owner-only business/employee/activity
   writes-and-reads — so publishing them is required, not optional.
4. **SMS region policy:** in **Authentication → Settings → SMS region policy**, make sure the
   **user's country is allowed**, or OTP delivery is blocked.
5. **Authorized domains:** add the GitHub Pages host (`singhalvivek.github.io`) under
   **Authentication → Settings → Authorized domains** so phone sign-in works in production.

The app deploys to GitHub Pages **unchanged** — there is no URL or token to configure in the app;
sign-in is by phone number and sync is automatic.

### Running the E2E suite against the project (optional)

The Playwright suite talks to **real Firebase Auth + Cloud Firestore** — no mocks. To run it:

1. **Test phone numbers:** under **Authentication → Phone → Phone numbers for testing**, register
   the two E2E numbers with fixed codes: owner `+919352277260` → `000000` and employee
   `+919000000002` → `222222` (these short-circuit SMS/reCAPTCHA/region-policy, so the suite is
   deterministic and free).
2. **Env:** in `frontend/.env.local`, set the 6 `NEXT_PUBLIC_FIREBASE_*` values and, optionally,
   `FIREBASE_SERVICE_ACCOUNT` (path to an Admin-SDK JSON key) so global-setup can reset the test
   users with the privileged Admin SDK; without it, it falls back to the client SDK.
3. **Rules:** the same published `firestore.rules` (step 3 above) must be live — the suite's
   owner/employee boundary assertions rely on them.

---

## Notes

- The frontend is a pure static export — it needs no server and can also be hosted on any static host under any sub-path by setting `NEXT_PUBLIC_BASE_PATH` accordingly.
- The `NEXT_PUBLIC_FIREBASE_*` values are inlined at build time, so changing the Firebase project requires a rebuild + redeploy.
