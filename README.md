# Stock Planner

Standalone mobile-friendly watchlist extracted from ILM’s stock UI. **Grouped sections** (semiconductors, hyperscalers, big tech), MRVL hero with INR holdings, extended-hours column rules, per-section top movers and sort, and move alerts (MRVL ±5%, others ±10%). Future ideas: [IMPROVEMENTS.md](./IMPROVEMENTS.md).

## Data source

- **Quotes:** Yahoo Finance chart API (`query1.finance.yahoo.com`) from the **browser** (no ILM backend).
- **ILM difference:** ILM backend tries **Google Finance first** (works on Marvell corporate proxy where Yahoo is blocked). This app does not scrape Google (CORS + HTML parsing need a server proxy).
- **Samsung / SK Hynix:** Yahoo symbols `005930.KS` and `000660.KS` (Korea Exchange, **KRW**). Not US Nasdaq listings; prices show in won, not dollars.

If Yahoo returns 503 from your network, deploy with a tiny proxy (see below) or use ILM’s `/api/stock/*` from a trusted host.

## Local dev

```bash
cd stock-planner
npm install
npm run dev
```

If `npm install` fails in a shared monorepo checkout, symlink deps once:

```bash
ln -sf ../frontend/node_modules node_modules
npm run dev   # or npm run build
```

Open the URL Vite prints (default `http://localhost:5173`).

## Deploy (recommended: Cloudflare Pages or Vercel)

For a **personal GitHub repo + Vercel import** (no Marvell remote), see [DEPLOY.md](./DEPLOY.md).

Both serve static `dist/` and allow **client-side** `fetch` to Yahoo from the user’s browser (not from the build server).

### Vercel

1. Push this repo (or only `stock-planner/` as repo root).
2. [vercel.com](https://vercel.com) → **Add Project** → import repo.
3. **Root Directory:** `stock-planner` (if monorepo) or `.` if this folder is the repo root.
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Deploy.

Or CLI:

```bash
cd stock-planner
npm i -g vercel
npm run build
vercel --prod
```

### Cloudflare Pages

1. **Workers & Pages** → **Create** → **Pages** → Connect Git.
2. Root: `stock-planner`, build: `npm run build`, output: `dist`.
3. Deploy.

### GitHub Pages

Set `base` in `vite.config.js` to your repo name (e.g. `base: '/iliad_lab_manager/'`), then:

```bash
npm run build
npx gh-pages -d dist
```

## Alerts on static hosting

- **Enabled:** `localStorage` + `sessionStorage` (same hysteresis as ILM).
- **Requires:** User taps **Enable alerts** → `Notification.requestPermission()`.
- **Polling:** MRVL every 60s; full watchlist every 5m while alerts are on (tab must stay open).
- **iOS:** Web Push / background polling is limited; treat as best-effort when the app is in the foreground.

## Optional: Yahoo proxy (corporate networks)

Add a serverless route that forwards to Yahoo with a User-Agent header, and point `src/lib/quotes.js` at that URL. ILM’s `backend/services/stock_quote.py` is the reference implementation.

## Files (minimal set)

```
stock-planner/
  index.html
  package.json
  vite.config.js
  src/
    App.jsx
    main.jsx
    index.css
    data/watchlist.js          # WATCHLIST_SECTIONS + semicon list
    lib/quotes.js
    lib/watchlistAnalytics.js
    lib/stockFormat.js
    lib/stockMarketSession.js
    lib/stockPriceAlerts.js
    components/WatchlistSections.jsx
    components/SemiconductorQuotesTable.jsx  # legacy flat layout
    components/StockPriceChangeLines.jsx
```

### UI tips

- **Sections** collapse with the chevron; headers stay sticky while scrolling within the watchlist card.
- **Sort:** “All sections” dropdown sets every group; each section can override with its own sort (Current or Pre/after, ↑/↓).
- **Compact** hides exchange sublabels for denser rows on phones.
- **MRVL-only:** INR price hints on rows and the holdings panel; other symbols stay USD/KRW only.

No changes to ILM backend or lab flash code.
