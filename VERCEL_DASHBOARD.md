# Vercel dashboard checklist (stock-planner)

## Git vs live (verify deploy)

| Check | Expected |
|--------|-----------|
| **GitHub repo** | `https://github.com/jadhavsagarpune-cmd/stock-planner` (standalone repo — **not** `iliad_lab_manager/stock-planner`) |
| **Production URL** | `https://stock-planner-three.vercel.app/` |
| **Root Directory** | `.` (repository root) |
| **Live proof** | Page footer: `Build <7-char git sha> · Yahoo v7 quote` matches `git rev-parse --short HEAD` on `main` |
| **Column headers** | `Prev close` · `Regular` · `Pre` / `After hrs` with subtitle `vs prev close` (pre) or `vs regular close` (post) |

Pushes only deploy when Vercel is linked to **this** GitHub repo at **root** `.`. A monorepo import with Root Directory = `stock-planner` inside another repo will **not** pick up commits pushed only to `jadhavsagarpune-cmd/stock-planner`.

**Project:** `jadhavsagarpune-cmd/stock-planner`  
**Settings → Build & Deployment**

| Field | Value |
|--------|--------|
| **Framework Preset** | **Other** (avoid Vite preset — it runs bare `vite build` → exit 127) |
| **Root Directory** | `.` (repo root; this app is the whole repo) |
| **Node.js Version** | **20.x** (matches `package.json` `"engines": { "node": ">=20" }`) |
| **Install Command** | **Leave EMPTY** (uses default `npm install`) — **do not** set a custom install that omits deps |
| **Build Command** | **Leave EMPTY** (repo `vercel.json` runs `npm install && npx vite build`) **OR** set exactly: `npm install && npx vite build` |
| **Output Directory** | **Leave EMPTY** (let `vercel.json` set `dist`) — turn dashboard override **OFF** |

## Clear broken overrides

If builds fail in ~3–4s with **exit 127** on `vite` / `npm run build`:

1. Open **Build & Deployment** → **Build Command** — if it shows `npm install && npm run build` (or any custom command), **clear it** or replace with the line above.
2. **Install Command** — clear any non-empty override unless it is exactly `npm install`.
3. **Output Directory** — clear wrong values; use empty (vercel.json) or `dist`.
4. Redeploy (push to `main` or **Deployments → Redeploy**).

## Repo-side fixes (already in tree)

- `package-lock.json` must resolve packages from the npm registry (not symlinks to another monorepo folder).
- `.npmrc`: `legacy-peer-deps=true` (peer-deps resolution on npm).
- `vite` **^6.3.5** (Node 20; Vite 8 preset on dashboard can cause exit 127).
- `scripts.build`: `npx vite build`
- `vercel.json`: `buildCommand`: `npm install && npx vite build`, `outputDirectory`: `dist` (no `framework` field).
