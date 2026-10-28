# Vercel dashboard checklist (stock-planner)

**Project:** `jadhavsagarpune-cmd/stock-planner`  
**Settings → Build & Deployment**

| Field | Value |
|--------|--------|
| **Framework Preset** | Other (or Vite — must not skip `npm install`) |
| **Root Directory** | `.` (repo root; this app is the whole repo) |
| **Node.js Version** | **20.x** (matches `package.json` `"engines": { "node": ">=20" }`) |
| **Install Command** | **Leave EMPTY** (uses default `npm install`) — **do not** set a custom install that omits deps |
| **Build Command** | **Leave EMPTY** (repo `vercel.json` runs `npm install && npx vite build`) **OR** set exactly: `npm install && npx vite build` |
| **Output Directory** | **Leave EMPTY** (uses `vercel.json` `dist`) **OR** set exactly: `dist` |

## Clear broken overrides

If builds fail in ~3–4s with **exit 127** on `vite` / `npm run build`:

1. Open **Build & Deployment** → **Build Command** — if it shows `npm install && npm run build` (or any custom command), **clear it** or replace with the line above.
2. **Install Command** — clear any non-empty override unless it is exactly `npm install`.
3. **Output Directory** — clear wrong values; use empty (vercel.json) or `dist`.
4. Redeploy (push to `main` or **Deployments → Redeploy**).

## Repo-side fixes (already in tree)

- `package-lock.json` must resolve packages from the npm registry (not symlinks to another monorepo folder).
- `.npmrc`: `legacy-peer-deps=true` (avoids npm peer-resolution crash on Vite 8).
- `scripts.build`: `npx vite build`
- `vercel.json`: `buildCommand`: `npm install && npx vite build`, `outputDirectory`: `dist` (no `framework` field).
