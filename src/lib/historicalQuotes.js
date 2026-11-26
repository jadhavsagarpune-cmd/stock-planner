import {
  getDailyBars,
  isDailyCacheFresh,
  putDailyBars,
} from './priceHistoryStore';
import { mergeLivePriceIntoBars, pickLiveChartPrice } from './chartLiveMerge';
import { HEATMAP_BASELINES } from './heatmapBaselines.js';
import { clientFetchTimeout, mergeAbortSignals, CLIENT_FETCH_TIMEOUT_MS } from './fetchTimeout.js';

export { mergeLivePriceIntoBars, pickLiveChartPrice };

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
const RETRY_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_PARALLEL = 6;
const DEFAULT_RANGE = '1y';
const DEFAULT_INTERVAL = '1d';

/** Chart range/interval for a baseline id (see HEATMAP_BASELINES[].chart). */
export function chartSpecForBaseline(baselineId) {
  const spec = HEATMAP_BASELINES.find((b) => b.id === baselineId) ?? HEATMAP_BASELINES[0];
  return spec.chart ?? { range: '1d', interval: '5m' };
}

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
  const qs = [
    `interval=${encodeURIComponent(interval)}`,
    `range=${encodeURIComponent(range)}`,
    'includePrePost=true',
  ].join('&');
  const chartPath = `/v8/finance/chart/${encodeURIComponent(sym)}?${qs}`;
  const useProxy = !import.meta.env.DEV && typeof window !== 'undefined';
  const targets = useProxy
    ? [chartHistoryUrl(sym, range, interval)]
    : YAHOO_HOSTS.map((host) => `https://${host}${chartPath}`);

  const { signal: timeoutSig, clear } = clientFetchTimeout(CLIENT_FETCH_TIMEOUT_MS);
  const sig = mergeAbortSignals(signal, timeoutSig);
  let lastStatus = 0;
  try {
    for (const url of targets) {
      try {
        const resp = await fetch(url, { headers: HEADERS, signal: sig });
        lastStatus = resp.status;
        if (resp.ok) {
          const payload = await resp.json();
          return parseYahooChartClosesPayload(payload);
        }
        if (!RETRY_HTTP_STATUSES.has(resp.status)) break;
      } catch {
        /* next host */
      }
    }
    throw new Error(`Yahoo HTTP ${lastStatus || 500}`);
  } finally {
    clear();
  }
}

/** @returns {Promise<{ t: number, close: number }[]>} */
export async function fetchYahooDailyCloses(symbol, { signal } = {}) {
  return fetchYahooChartCloses(symbol, {
    range: DEFAULT_RANGE,
    interval: DEFAULT_INTERVAL,
    signal,
  });
}

/** Cached bars must reach back past Jan 1 so the YTD filter has a base close. */
function coversYearStart(bars) {
  if (!bars?.length) return false;
  const jan1 = Date.UTC(new Date().getUTCFullYear(), 0, 1);
  return bars[0].t <= jan1 + 7 * 24 * 3600 * 1000;
}

/**
 * Load daily closes from IndexedDB or Yahoo; updates IDB cache.
 * @returns {Promise<{ t: number, close: number }[]>}
 */
export async function loadDailyBarsForSymbol(symbol, { force } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!force) {
    const cached = await getDailyBars(sym);
    if (isDailyCacheFresh(cached) && coversYearStart(cached.bars)) return cached.bars;
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
