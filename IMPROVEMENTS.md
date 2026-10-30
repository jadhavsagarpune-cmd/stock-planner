# Future improvements (not implemented)

Ideas for later passes on the stock-planner UI and data layer:

1. **ETF correlation panel** — Show SOXX / SMH / QQQ day change next to each section avg for quick beta context.
2. **52-week range sparkline** — Mini range bar (low–high) per row from Yahoo `range=1y` or summary endpoint.
3. **Volume vs average** — Relative volume badge when regular session volume exceeds 20-day average.
4. **After-hours sort default** — Auto-switch global sort to extended ↓/↑ when US clock is pre/post and column is live.
5. **Per-section move alerts** — Separate thresholds or mute list for hyperscalers vs semicon (today: one global ±10%).
6. **User-editable watchlists** — `localStorage` custom symbols per section with validation.
7. **Sector heatmap** — Single glance grid colored by `regular_change_pct` across all sections.
8. **FX-aware semicon avg** — Weight KRW names to USD for a more comparable section average (spot FX).
9. **Offline / stale cache** — Last-good quote timestamp per symbol when Yahoo fails mid-session.
10. **Export snapshot** — CSV or share image of section summaries for standup notes.

See [README.md](./README.md) for current behavior (grouped sections, sort, movers, MRVL INR).
