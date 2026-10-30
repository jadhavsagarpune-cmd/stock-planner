import { pickExtendedQuote } from './stockFormat';

export const SORT_OPTIONS = [
  { value: 'default', label: 'Default order' },
  { value: 'current_desc', label: 'Current ↓' },
  { value: 'current_asc', label: 'Current ↑' },
  { value: 'ext_desc', label: 'Pre/after ↓' },
  { value: 'ext_asc', label: 'Pre/after ↑' },
];

function symKey(it) {
  return String(it?.name || '').trim().toUpperCase();
}

function numericPct(v) {
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
}

export function regularSortPct(it) {
  if (it?.status !== 'done') return null;
  return numericPct(it.regular_change_pct);
}

export function extendedSortPct(it, extendedMode) {
  if (it?.status !== 'done' || extendedMode === 'regular') return null;
  const ext = pickExtendedQuote(it, extendedMode);
  return numericPct(ext?.pct);
}

export function sortWatchlistItems(items, sortKey, extendedMode, { pinMrvlFirst = false } = {}) {
  const list = [...items];
  if (sortKey === 'default') {
    if (pinMrvlFirst) {
      const mrvl = list.filter((it) => symKey(it) === 'MRVL');
      const rest = list.filter((it) => symKey(it) !== 'MRVL');
      return [...mrvl, ...rest];
    }
    return list;
  }

  const pick = (it) => {
    if (sortKey === 'current_desc' || sortKey === 'current_asc') return regularSortPct(it);
    return extendedSortPct(it, extendedMode);
  };

  const asc = sortKey === 'current_asc' || sortKey === 'ext_asc';

  return list.sort((a, b) => {
    const pa = pick(a);
    const pb = pick(b);
    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;
    return asc ? pa - pb : pb - pa;
  });
}

export function sectionSummaryStats(items) {
  const done = items.filter((it) => it.status === 'done');
  const pcts = done.map((it) => numericPct(it.regular_change_pct)).filter((p) => p != null);
  let up = 0;
  let down = 0;
  let flat = 0;
  for (const p of pcts) {
    if (p > 0) up += 1;
    else if (p < 0) down += 1;
    else flat += 1;
  }
  const avg =
    pcts.length > 0 ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null;
  return { avg, up, down, flat, quoted: done.length, total: items.length };
}

export function topMoversByRegularPct(items, { count = 1 } = {}) {
  const done = items.filter((it) => it.status === 'done');
  const withPct = done
    .map((it) => ({ it, pct: regularSortPct(it) }))
    .filter((x) => x.pct != null);
  if (!withPct.length) return { gainer: null, loser: null };

  let gainer = withPct[0];
  let loser = withPct[0];
  for (const x of withPct) {
    if (x.pct > gainer.pct) gainer = x;
    if (x.pct < loser.pct) loser = x;
  }
  return { gainer: gainer?.it ?? null, loser: loser?.it ?? null };
}
