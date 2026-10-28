# Personal deploy (GitHub + Vercel)

Use this when `stock-planner` lives under `iliad_lab_manager` on disk but you want your **own** GitHub repo and Vercel project — without pushing to any Marvell org remote.

## Prerequisites

- Node.js 20+ (matches Vite 8)
- A **personal** GitHub account
- A [Vercel](https://vercel.com) account (free tier is enough)

## 1. Local git (this folder only)

From the machine where `stock-planner/` lives:

```bash
cd /path/to/stock-planner

# If not already initialized:
git init
git branch -M main

git add .
git commit -m "Initial stock-planner standalone app"
```

**Do not** add a `origin` pointing at Marvell. You will add your personal remote in step 2.

Verify no accidental remote:

```bash
git remote -v
# (empty output is correct before step 2)
```

## 2. Create a personal GitHub repository

1. GitHub → **New repository** (your user, not Marvell org).
2. Name example: `stock-planner`.
3. **Do not** initialize with README (you already have one).
4. Copy the HTTPS or SSH URL, e.g. `https://github.com/YOUR_USER/stock-planner.git`.

Add remote and push **only to your repo**:

```bash
git remote add origin https://github.com/YOUR_USER/stock-planner.git
git push -u origin main
```

## 3. Import on Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**.
2. Select **your** `stock-planner` repo (GitHub OAuth).
3. Project settings:
   - **Framework Preset:** Vite (or Other — `vercel.json` already sets this)
   - **Root Directory:** `.` (repo root is `stock-planner/`)
   - **Build Command:** `npm run build` (default with `vercel.json`)
   - **Output Directory:** `dist`
4. **Deploy**.

Production URL will look like `https://stock-planner-xxxx.vercel.app` (or your custom domain).

## 4. Optional: CLI deploy (no Git push)

If you prefer CLI instead of Git-connected Vercel:

```bash
cd /path/to/stock-planner
npm install
npm run build
npx vercel login          # one-time browser auth
npx vercel --prod         # follow prompts; link or create project
```

Requires `vercel login` or a valid `VERCEL_TOKEN` in the environment (create at Vercel → Settings → Tokens).

## 5. Verify after deploy

- Open the Vercel URL on desktop and phone.
- Confirm MRVL and watchlist load (Yahoo Finance from the browser).
- Tap **Enable alerts** and allow notifications (best-effort on iOS).

If quotes fail with 503, your network may block Yahoo; see README “Optional: Yahoo proxy”.

## What stays out of scope

- No push to `iliad_lab_manager` Marvell remotes.
- No changes to ILM backend or lab automation in the parent tree.
