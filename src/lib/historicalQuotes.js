import {
  getDailyBars,
  isDailyCacheFresh,
  putDailyBars,
} from './priceHistoryStore';
import { mergeLivePriceIntoBars, pickLiveChartPrice } from './chartLiveMerge';

export { mergeLivePriceIntoBars, pickLiveChartPrice };

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';
const HEADERS = { Accept: 'application/json' };
const MAX_PARALLEL = 6;
const DEFAULT_RANGE = '3mo';
const DEFAULT_INTERVAL = '1d';

/** Google Finance–style range chips for MRVL chart (Yahoo chart v8 range/interval). */
export const MRVL_CHART_RANGES = [
  { id: '5D', label: '5D', range: '5d', interval: '15m' },
  { id: '7D', label: '7D', range: '7d', interval: '30m' },
  { id: '1M', label: '1M', range: '1mo', interval: '1d' },
  { id: '3M', label: '3M', range: '3mo', interval: '1d' },
  { id: '6M', label: '6M', range: '6mo', interval: '1d' },
  { id: 'YTD', label: 'YTD', range: 'ytd', interval: '1d' },
  { id: '1Y', label: '1Y', range: '1y', interval: '1d' },
  { id: '5Y', label: '5Y', range: '5y', interval: '1wk' },
];

export const DEFAULT_MRVL_CHART_RANGE_ID = '1M';

export function chartHistoryUrl(symbol, range = DEFAULT_RANGE, interval = DEFAULT_INTERVAL) {
  const sym = String(symbol || '').trim().toUpperCase();
  const qs = [
    `interval=${encodeURIComponent(interval)}`,
    `range=${encodeURIComponent(range)}`,
    'includePrePost=true',
  ].join('&');
  if (import.meta.env.DEV) {
    return `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(sym))}?${qs}`;
  }
  return `/api/quote?symbol=${encodeURIComponent(sym)}&${qs}`;
}

export function parseYahooChartClosesPayload(payload) {
  const err = payload?.chart?.error;
  if (err) throw new Error(err.description || err.code || 'Yahoo chart error');
  const results = payload?.chart?.result || [];
  if (!results.length) throw new Error('No chart data');
  const { timestamp: stamps, indicators } = results[0];
  let closes = indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes) || !closes.some((c) => float(c) != null)) {
    closes = indicators?.adjclose?.[0]?.adjclose;
  }
  if (!Array.isArray(stamps) || !Array.isArray(closes)) return [];
  const bars = [];
  for (let i = 0; i < stamps.length; i += 1) {
    const c = float(closes[i]);
    const t = float(stamps[i]);
    if (c == null || t == null) continue;
    bars.push({ t: t * 1000, close: c });
  }
  return bars;
}

function float(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** @returns {Promise<{ t: number, close: number }[]>} */
export async function fetchYahooChartCloses(
  symbol,
  { range = DEFAULT_RANGE, interval = DEFAULT_INTERVAL, signal } = {},
) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) throw new Error('symbol required');
  const resp = await fetch(chartHistoryUrl(sym, range, interval), { headers: HEADERS, signal });
  if (!resp.ok) throw new Error(`Yahoo HTTP ${resp.status}`);
  const payload = await resp.json();
  return parseYahooChartClosesPayload(payload);
}

/** @returns {Promise<{ t: number, close: number }[]>} */
export async function fetchYahooDailyCloses(symbol, { signal } = {}) {
  return fetchYahooChartCloses(symbol, {
    range: DEFAULT_RANGE,
    interval: DEFAULT_INTERVAL,
    signal,
  });
}

/**
 * Load daily closes from IndexedDB or Yahoo; updates IDB cache.
 * @returns {Promise<{ t: number, close: number }[]>}
 */
export async function loadDailyBarsForSymbol(symbol, { force } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!force) {
    const cached = await getDailyBars(sym);
    if (isDailyCacheFresh(cached)) return cached.bars;
  }
  try {
    const bars = await fetchYahooDailyCloses(sym);
    if (bars.length) await putDailyBars(sym, bars);
    return bars;
  } catch {
    const cached = await getDailyBars(sym);
    return cached?.bars ?? [];
  }
}

/** @param {string[]} symbols @returns {Promise<Map<string, { bars: object[] }>>} */
export async function prefetchDailyBarsForSymbols(symbols, { onProgress } = {}) {
  const uniq = [...new Set(symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  const map = new Map();
  let idx = 0;

  async function worker() {
    while (idx < uniq.length) {
      const i = idx;
      idx += 1;
      const sym = uniq[i];
      const bars = await loadDailyBarsForSymbol(sym);
      map.set(sym, { bars });
      onProgress?.(map);
    }
  }

  const workers = Array.from({ length: Math.min(MAX_PARALLEL, uniq.length || 1) }, () => worker());
  await Promise.all(workers);
  return map;
}
