import {
  formatChangePct,
  formatStockPrice,
  pickHeatmapChangePct,
  pickHeatmapPrice,
} from './stockFormat.js';
import {
  closedExtendedModeByClock,
  heatmapSessionMeta,
  isUsRegularSessionByClock,
  normalizeMarketState,
  resolveUsExtendedColumnMode,
} from './stockMarketSession.js';

export const HEATMAP_BASELINE_STORAGE_KEY = 'stock-planner.heatmapBaseline';
export const HEATMAP_BASELINE_USER_PICKED_KEY = 'stock-planner.heatmapBaselineUserPicked';

/** Heatmap % reference options (independent of watchlist session column). */
export const HEATMAP_BASELINES = [
  {
    id: 'live',
    label: 'Live',
    badge: 'LIVE',
    subtitle: 'Regular session % vs previous close (Yahoo day change)',
    needsSessionPrice: true,
    sessionMode: 'regular',
  },
  {
    id: 'pre',
    label: 'Pre-market',
    badge: 'PRE',
    subtitle: 'Pre-market % vs previous close',
    needsSessionPrice: true,
    sessionMode: 'pre',
  },
  {
    id: 'post',
    label: 'After Market',
    badge: 'AFTER',
    subtitle: 'After-hours % vs regular session close',
    needsSessionPrice: true,
    sessionMode: 'post',
  },
  {
    id: 'previous_close',
    label: 'Previous close',
    badge: 'PREV',
    subtitle: '% vs prior session close (today)',
  },
  {
    id: '1d',
    label: '1 day',
    badge: '1D',
    subtitle: '% vs prior trading day close',
    tradingDaysBack: 1,
  },
  {
    id: '3d',
    label: '3 days',
    badge: '3D',
    subtitle: '% vs close 3 sessions ago',
    tradingDaysBack: 3,
  },
  {
    id: '5d',
    label: '5 days',
    badge: '5D',
    subtitle: '% vs close 5 sessions ago',
    tradingDaysBack: 5,
  },
  {
    id: '15d',
    label: '15 days',
    badge: '15D',
    subtitle: '% vs close 15 sessions ago',
    tradingDaysBack: 15,
  },
  {
    id: '1mo',
    label: '1 month',
    badge: '1M',
    subtitle: '% vs ~1 month ago close',
    calendarDaysBack: 30,
  },
];

/** Session chips (LIVE / PRE / POST) vs multi-day reference chips. */
export function heatmapBaselinePickerGroups() {
  const session = [];
  const history = [];
  for (const b of HEATMAP_BASELINES) {
    if (b.sessionMode) session.push(b);
    else history.push(b);
  }
  return { session, history };
}

/** First-visit default: RTH → live, pre → pre, post → post, NYSE holiday → previous_close. */
export function defaultHeatmapBaselineIdForClock(now = new Date()) {
  const ext = closedExtendedModeByClock(now);
  if (ext === 'holiday') return 'previous_close';
  if (isUsRegularSessionByClock(now)) return 'live';
  if (ext === 'pre') return 'pre';
  return 'post';
}

export function heatmapBaselineUserPicked() {
  try {
    return localStorage.getItem(HEATMAP_BASELINE_USER_PICKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function loadHeatmapBaselineId(now = new Date()) {
  const derived = defaultHeatmapBaselineIdForClock(now);
  try {
    const userPicked = heatmapBaselineUserPicked();
    const v = localStorage.getItem(HEATMAP_BASELINE_STORAGE_KEY);
    if (userPicked && v && HEATMAP_BASELINES.some((b) => b.id === v)) return v;
    if (!userPicked && v !== derived) {
      try {
        localStorage.setItem(HEATMAP_BASELINE_STORAGE_KEY, derived);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return derived;
}

function baselineSessionMode(baselineId) {
  const spec = HEATMAP_BASELINES.find((b) => b.id === baselineId);
  return spec?.sessionMode ?? null;
}

export function saveHeatmapBaselineId(id) {
  try {
    localStorage.setItem(HEATMAP_BASELINE_STORAGE_KEY, id);
    localStorage.setItem(HEATMAP_BASELINE_USER_PICKED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} baselineId
 * @param {'pre'|'post'|'regular'} [clockExtendedMode] — US session from clock/quotes (for LIVE filter badge)
 */
export function heatmapBaselineMeta(baselineId, clockExtendedMode = 'regular') {
  const base = HEATMAP_BASELINES.find((b) => b.id === baselineId) ?? HEATMAP_BASELINES[0];
  const liveBadgeClass =
    'bg-emerald-950/80 text-emerald-300 border-emerald-600/50 ring-1 ring-emerald-500/30';
  if (base.id === 'live') {
    const rth = clockExtendedMode === 'regular';
  const liveSubtitle = rth
      ? 'Regular session % vs previous close · clustered by move'
      : clockExtendedMode === 'holiday'
        ? 'Last regular session % vs previous close · market holiday'
        : 'Regular session day % vs previous close (session not open for live ticks)';
    return {
      badge: 'LIVE',
      title: rth ? 'Market heatmap · Live' : 'Market heatmap · Live (last close)',
      subtitle: liveSubtitle,
      badgeClass: liveBadgeClass,
      base,
    };
  }
  if (base.sessionMode) {
    return { ...heatmapSessionMeta(base.sessionMode), base };
  }
  const badgeClass = 'bg-slate-800/80 text-slate-300 border-slate-600/50';
  return {
    title: `Market heatmap · ${base.label}`,
    badge: base.badge,
    subtitle: base.subtitle,
    badgeClass,
    base,
  };
}

function rowSessionMode(it) {
  const state = normalizeMarketState(it?.market_state);
  if (state === 'REGULAR') return 'regular';
  return resolveUsExtendedColumnMode(it?.market_state);
}

function floatQuote(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deriveChangePct(price, basePrice) {
  if (price == null || basePrice == null || basePrice === 0) return null;
  const p = Number(price);
  const b = Number(basePrice);
  if (Number.isNaN(p) || Number.isNaN(b)) return null;
  return ((p - b) / b) * 100;
}

/** Latest tradable tick for multi-day comparisons. */
export function pickCurrentHeatmapPrice(it) {
  if (!it || it.status !== 'done') return null;
  const candidates = [
    it.current_price,
    it.fullday_price,
    it.postmarket_price,
    it.premarket_price,
    it.regular_price,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (c != null && !Number.isNaN(n)) return n;
  }
  return null;
}

function closeAtTradingDaysAgo(bars, daysBack) {
  if (!bars?.length || daysBack < 1) return null;
  const idx = bars.length - 1 - daysBack;
  const pick = bars[Math.max(0, idx)];
  return pick?.close ?? null;
}

function closeAtCalendarDaysAgo(bars, calendarDays) {
  if (!bars?.length || calendarDays < 1) return null;
  const target = Date.now() - calendarDays * 24 * 60 * 60 * 1000;
  let chosen = bars[0];
  for (const bar of bars) {
    if (bar.t <= target) chosen = bar;
    else break;
  }
  return chosen?.close ?? null;
}

/**
 * @param {object} it — watchlist row
 * @param {string} baselineId
 * @param {{ bars?: { t: number, close: number }[] } | null} daily
 */
export function pickHeatmapChangePctForBaseline(it, baselineId, daily = null) {
  if (!it || it.status !== 'done') return null;
  const sym = String(it.name || '').trim().toUpperCase();

  const forcedSession = baselineSessionMode(baselineId);
  if (forcedSession) {
    return pickHeatmapChangePct(it, forcedSession);
  }

  if (baselineId === 'previous_close') {
    const prev = floatQuote(it.previous_close);
    const px = pickCurrentHeatmapPrice(it) ?? floatQuote(it.regular_price);
    if (prev != null && prev > 0 && px != null) {
      const d = deriveChangePct(px, prev);
      if (d != null && Number.isFinite(d)) return d;
    }
    if (sym.endsWith('.KS')) {
      const n = Number(it.regular_change_pct);
      if (Number.isFinite(n)) return n;
    }
    return pickHeatmapChangePct(it, rowSessionMode(it));
  }

  const current = pickCurrentHeatmapPrice(it);
  const bars = daily?.bars;
  const spec = HEATMAP_BASELINES.find((b) => b.id === baselineId);
  if (!spec?.tradingDaysBack && !spec?.calendarDaysBack) return null;
  if (!bars?.length) return null;

  let baseClose = null;
  if (spec.tradingDaysBack != null) {
    baseClose = closeAtTradingDaysAgo(bars, spec.tradingDaysBack);
  } else if (spec.calendarDaysBack != null) {
    baseClose = closeAtCalendarDaysAgo(bars, spec.calendarDaysBack);
  }
  return deriveChangePct(current, baseClose);
}

export function pickHeatmapPriceForBaseline(it, baselineId, daily = null) {
  if (!it || it.status !== 'done') return null;
  const forcedSession = baselineSessionMode(baselineId);
  if (forcedSession) {
    return pickHeatmapPrice(it, forcedSession) ?? pickCurrentHeatmapPrice(it);
  }
  if (baselineId === 'previous_close') {
    return pickCurrentHeatmapPrice(it) ?? it.regular_price;
  }
  const current = pickCurrentHeatmapPrice(it);
  if (current != null) return current;
  const bars = daily?.bars;
  return bars?.length ? bars[bars.length - 1].close : it.regular_price;
}

export function formatHeatmapTileTitleForBaseline(
  label,
  it,
  pct,
  baselineId,
  daily = null,
  clockExtendedMode = 'regular',
) {
  const meta = heatmapBaselineMeta(baselineId, clockExtendedMode);
  const parts = [label];
  const price = pickHeatmapPriceForBaseline(it, baselineId, daily);
  const priceStr = formatStockPrice(price, it?.currency);
  if (priceStr && priceStr !== '—') parts.push(priceStr);
  const pctStr = formatChangePct(pct);
  if (pctStr) parts.push(pctStr);
  parts.push(`vs ${meta.badge}`);
  return parts.join(' · ');
}

export function baselineNeedsDailyHistory(baselineId) {
  const spec = HEATMAP_BASELINES.find((b) => b.id === baselineId);
  return Boolean(spec?.tradingDaysBack || spec?.calendarDaysBack);
}
