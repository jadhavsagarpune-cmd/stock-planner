const US_TZ = 'America/New_York';

const INTERVAL_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1wk': 7 * 24 * 60 * 60 * 1000,
};

function float(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function usDateKey(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: US_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

import { pickLiveChartPrice } from './sessionQuote.js';

export { pickActiveSessionPrice, pickLiveChartPrice } from './sessionQuote.js';

/**
 * Extend the series through the active session using the polled quote (chart fetch is range-static).
 * @param {{ t: number, close: number }[]} bars
 */
export function mergeLivePriceIntoBars(bars, quote, { interval = '1d' } = {}) {
  if (!bars?.length) return bars ?? [];
  const price = pickLiveChartPrice(quote);
  if (price == null) return bars;

  const now = Date.now();
  const out = bars.slice();
  const last = out[out.length - 1];
  const daily = interval === '1d' || interval === '1wk';

  if (daily) {
    if (usDateKey(last.t) === usDateKey(now)) {
      out[out.length - 1] = { ...last, close: price };
    } else {
      out.push({ t: now, close: price });
    }
    return out;
  }

  const bucket = INTERVAL_MS[interval] ?? INTERVAL_MS['15m'];
  if (now - last.t <= bucket * 1.25) {
    out[out.length - 1] = { ...last, close: price };
  } else {
    out.push({ t: now, close: price });
  }
  return out;
}
