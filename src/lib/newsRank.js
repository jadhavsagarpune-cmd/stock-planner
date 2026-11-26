export const NEWS_KEYWORDS = [
  'earnings', 'guidance', 'upgrade', 'downgrade', 'export', 'tariff', 'china', 'ai capex',
  'acquisition', 'lawsuit', 'probe', 'outlook', 'forecast', 'layoffs',
];
const KEYWORD_BOOST = 2;

export function keywordBoost(title) {
  const t = String(title || '').toLowerCase();
  return NEWS_KEYWORDS.reduce((n, k) => (t.includes(k) ? n + KEYWORD_BOOST : n), 0);
}

/** symbol -> today's % move from watchlist quote rows (+ optional MRVL quote). */
export function buildMoveMap(rows, mrvl) {
  const m = new Map();
  for (const r of rows || []) {
    const p = Number(r?.regular_change_pct);
    if (r?.status === 'done' && r.regular_change_pct != null && Number.isFinite(p)) m.set(r.name, p);
  }
  const mp = Number(mrvl?.regular_change_pct);
  if (mrvl?.regular_change_pct != null && Number.isFinite(mp)) m.set('MRVL', mp);
  return m;
}

export function scoreItem(item, moves) {
  const move = Math.max(0, ...(item.tickers || []).map((s) => Math.abs(moves.get(s) ?? 0)));
  return move + keywordBoost(item.title);
}

/** Marvell: newest first. Others: score desc, then newest. */
export function rankNews(items, moves) {
  const scored = (items || []).map((i) => ({ ...i, score: scoreItem(i, moves) }));
  const t = (i) => Date.parse(i.publishedAt) || 0;
  return scored.sort((a, b) => {
    const am = a.category === 'marvell';
    const bm = b.category === 'marvell';
    if (am !== bm) return am ? -1 : 1;
    if (am) return t(b) - t(a);
    return b.score - a.score || t(b) - t(a);
  });
}

export function timeAgo(iso, now = Date.now()) {
  const ms = now - (Date.parse(iso) || now);
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
