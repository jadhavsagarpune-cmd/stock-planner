/**
 * Build a Yahoo v7-shaped quote row from a v8 chart result (range=1d, interval=1m,
 * includePrePost=true). Chart v8 works from Vercel; v7 needs a crumb and often fails there.
 * After-hours / pre-market price = last extended-hours bar (meta rarely carries postMarketPrice).
 */

function num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pos(v) {
  const n = num(v);
  return n != null && n > 0 ? n : null;
}

function lastBar(timestamps, closes, from, to) {
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return null;
  for (let i = timestamps.length - 1; i >= 0; i -= 1) {
    const t = timestamps[i];
    if (t < from) break;
    if (t >= to) continue;
    const c = pos(closes[i]);
    if (c != null) return { price: c, time: t };
  }
  return null;
}

export function deriveMarketState(meta, nowSec) {
  const cp = meta?.currentTradingPeriod;
  const pre = cp?.pre;
  const reg = cp?.regular;
  const post = cp?.post;
  if (!reg || !pre || !post) return null;
  if (nowSec >= reg.start && nowSec < reg.end) return 'REGULAR';
  if (nowSec >= pre.start && nowSec < reg.start) return 'PRE';
  if (nowSec >= reg.end && nowSec < post.end) return 'POST';
  return 'CLOSED';
}

/**
 * @param {object} result chart.result[0]
 * @param {string} symbol
 * @param {{ nowSec?: number, priorCloseOverride?: number|null }} [opts]
 * @returns {object|null} v7-like row (never carries non-positive prices)
 */
export function chartResultToQuoteRow(result, symbol, opts = {}) {
  const meta = result?.meta;
  if (!meta) return null;
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const ts = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const cp = meta.currentTradingPeriod;
  const marketState = deriveMarketState(meta, nowSec) || meta.marketState || 'CLOSED';

  let regularPrice = pos(meta.regularMarketPrice);
  if (regularPrice == null && cp?.regular) {
    regularPrice = lastBar(ts, closes, cp.regular.start, cp.regular.end)?.price ?? null;
  }
  let prev =
    pos(opts.priorCloseOverride)
    ?? pos(meta.regularMarketPreviousClose)
    ?? pos(meta.chartPreviousClose)
    ?? pos(meta.previousClose);
  if (regularPrice == null) regularPrice = prev;
  if (regularPrice == null) return null;
  if (prev == null) prev = regularPrice;

  const row = {
    symbol: String(meta.symbol || symbol || '').toUpperCase(),
    currency: meta.currency || 'USD',
    exchange: meta.exchangeName,
    fullExchangeName: meta.fullExchangeName,
    marketState,
    regularMarketPrice: regularPrice,
    regularMarketPreviousClose: prev,
    previousClose: prev,
    regularMarketChange: regularPrice - prev,
    regularMarketChangePercent: ((regularPrice - prev) / prev) * 100,
    regularMarketTime: num(meta.regularMarketTime),
    regularMarketOpen: pos(meta.regularMarketOpen),
    regularMarketDayHigh: pos(meta.regularMarketDayHigh),
    regularMarketDayLow: pos(meta.regularMarketDayLow),
    fiftyTwoWeekHigh: pos(meta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: pos(meta.fiftyTwoWeekLow),
    source: 'yahoo_chart',
  };

  let ext = null;
  if (cp?.regular && cp?.post && cp?.pre) {
    if (marketState === 'PRE') {
      const b = lastBar(ts, closes, cp.pre.start, cp.regular.start);
      if (b) {
        row.preMarketPrice = b.price;
        row.preMarketTime = b.time;
        row.preMarketChange = b.price - regularPrice;
        row.preMarketChangePercent = ((b.price - regularPrice) / regularPrice) * 100;
        ext = b;
      }
    } else if (marketState !== 'REGULAR') {
      const b = lastBar(ts, closes, cp.regular.end, cp.post.end + 60);
      if (b) {
        row.postMarketPrice = b.price;
        row.postMarketTime = b.time;
        row.postMarketChange = b.price - regularPrice;
        row.postMarketChangePercent = ((b.price - regularPrice) / regularPrice) * 100;
        ext = b;
      }
    }
  }
  row.currentPrice = ext?.price ?? regularPrice;
  return row;
}

/** Copy derived fields onto chart meta (only fills gaps) so /api/quote clients get them too. */
export function enrichChartPayload(payload, symbol, opts = {}) {
  const result = payload?.chart?.result?.[0];
  if (!result) return payload;
  const row = chartResultToQuoteRow(result, symbol, opts);
  if (!row) return payload;
  const meta = result.meta;
  for (const [k, v] of Object.entries(row)) {
    if (v == null) continue;
    if (meta[k] == null || k === 'marketState' || k === 'regularMarketPreviousClose') meta[k] = v;
  }
  return payload;
}

/** For PRE sessions the 1d chart's previous close equals at-close; read the daily series instead. */
export async function priorCloseFromDaily(symbol, yahooFetch) {
  try {
    const resp = await yahooFetch(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { timeoutMs: 4_500, attemptsPerHost: 1 },
    );
    if (!resp?.ok) return null;
    const j = await resp.json();
    const closes = (j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
      .map(pos)
      .filter((c) => c != null);
    const reg = pos(j?.chart?.result?.[0]?.meta?.regularMarketPrice);
    if (closes.length < 2) return null;
    const last = closes[closes.length - 1];
    if (reg != null && Math.abs(last - reg) / reg < 0.01) return closes[closes.length - 2];
    return last;
  } catch {
    return null;
  }
}

/** Fetch chart (1d/1m, includePrePost) for one symbol and return a quote row or null. */
export async function fetchChartQuoteRow(symbol, yahooFetch, { timeoutMs = 5_000 } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  try {
    const resp = await yahooFetch(
      `/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=true`,
      { timeoutMs, attemptsPerHost: 1 },
    );
    if (!resp?.ok) return null;
    const payload = await resp.json();
    const result = payload?.chart?.result?.[0];
    if (!result) return null;
    let row = chartResultToQuoteRow(result, sym);
    if (row?.marketState === 'PRE') {
      const prior = await priorCloseFromDaily(sym, yahooFetch);
      if (prior) row = chartResultToQuoteRow(result, sym, { priorCloseOverride: prior });
    }
    return row;
  } catch {
    return null;
  }
}
