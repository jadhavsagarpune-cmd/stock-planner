# Future improvements (not implemented)

Ideas for later passes on the stock-planner UI and data layer:

## Shipped (2026-10-30)

1. **ETF correlation panel** — SOXX / SMH / QQQ session % chips beside each section summary (fetched on Refresh).
2. **After-hours sort hint** — Pre/post banner + highlighted global sort when extended hours are live; one-click Pre/after ↓/↑.
3. **Sector heatmap** — Compact per-section grid colored by `regular_change_pct`.
4. **Export snapshot** — **Export CSV** button (quotes + section summary rows).

## Still open

2. **52-week range sparkline** — Mini range bar (low–high) per row from Yahoo `range=1y` or summary endpoint.
3. **Volume vs average** — Relative volume badge when regular session volume exceeds 20-day average.
5. **Per-section move alerts** — Separate thresholds or mute list for hyperscalers vs semicon (today: one global ±10%).
6. **User-editable watchlists** — `localStorage` custom symbols per section with validation.
8. **FX-aware semicon avg** — Weight KRW names to USD for a more comparable section average (spot FX).
9. **Offline / stale cache** — Last-good quote timestamp per symbol when Yahoo fails mid-session.

See [README.md](./README.md) for current behavior (grouped sections, sort, movers, MRVL INR).
