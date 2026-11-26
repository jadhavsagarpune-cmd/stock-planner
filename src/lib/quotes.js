import { closedExtendedModeByClock, isUsRegularSessionByClock } from './stockMarketSession.js';
import { quoteIsRenderable, sanitizeQuotePrices } from './quoteResilience.js';
import {
  isStooqFallbackMeta,
  mergeYahooExtendedFields,
  YAHOO_EXTENDED_FIELD_KEYS,
} from './yahooExtendedMerge.js';
import {
  CLIENT_FETCH_TIMEOUT_MS,
  clientFetchTimeout,
  mergeAbortSignals,
} from './fetchTimeout.js';

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';
const YAHOO_QUOTE_V7 = 'https://query1.finance.yahoo.com/v7/finance/quote';
const RETRY_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const CHART_QS = 'interval=1m&range=1d&includePrePost=true';

/**
 * Yahoo field mapping (trust v7 quote summary for prices; chart v8 for intraday series only):
 * - previous_close ← regularMarketPreviousClose ?? previousClose (never chartPreviousClose when v7 present)
 * - regular_price ← regularMarketPrice (+ unstuck helper when meta lags on gap days)
 * - regular_change_* ← vs previous_close (regularMarketChange / Percent)
 * - postmarket_* / premarket_* ← vs last at close (regularMarketPrice), not prior session close
 * - previous_close ← regularMarketPreviousClose (regular day % only)
 */
const QUOTE_SUMMARY_KEYS = [
  'symbol',
  'currency',
  'marketState',
  'exchange',
  'fullExchangeName',
  'regularMarketPrice',
  'regularMarketPreviousClose',
  'previousClose',
  'regularMarketChange',
  'regularMarketChangePercent',
  'postMarketPrice',
  'postMarketChange',
  'postMarketChangePercent',
  'preMarketPrice',
  'preMarketChange',
  'preMarketChangePercent',
  'regularMarketTime',
  'postMarketTime',
  'preMarketTime',
  'regularMarketOpen',
  'regularMarketDayHigh',
  'regularMarketDayLow',
  'fiftyTwoWeekHigh',
  'fiftyTwoWeekLow',
];

/** Production (Vercel): same-origin proxy avoids browser CORS blocks on Yahoo. */
function chartFetchUrl(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  const direct = `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(sym))}?${CHART_QS}`;
  if (import.meta.env?.DEV) return direct;
  if (typeof window === 'undefined') return direct;
  return `/api/quote?symbol=${encodeURIComponent(sym)}&${CHART_QS}`;
}

function quoteSummaryFetchUrl(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  const direct = `${YAHOO_QUOTE_V7}?symbols=${encodeURIComponent(sym)}`;
  if (import.meta.env?.DEV) return direct;
  if (typeof window === 'undefined') return direct;
  return `/api/quote-summary?symbol=${encodeURIComponent(sym)}`;
}

function quotesBatchFetchUrl(symbols) {
  const list = symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  if (import.meta.env?.DEV || typeof window === 'undefined') return null;
  return `/api/quotes-batch?symbols=${encodeURIComponent(list.join(','))}`;
}

function effectiveSignal(outerSignal) {
  const { signal: timeoutSig, clear } = clientFetchTimeout(CLIENT_FETCH_TIMEOUT_MS);
  const merged = mergeAbortSignals(outerSignal, timeoutSig);
  return { signal: merged, clear };
}

function summaryFetchTargets(sym) {
  const useProxy = !import.meta.env?.DEV && typeof window !== 'undefined';
  if (useProxy) {
    return [quoteSummaryFetchUrl(sym)];
  }
  const qs = `/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
  return YAHOO_HOSTS.map((host) => `https://${host}${qs}`);
}

async function fetchYahooQuoteSummaryRow(symbol, { signal } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  const { signal: sig, clear } = effectiveSignal(signal);
  const targets = summaryFetchTargets(sym);
  try {
    for (const url of targets) {
      try {
        const resp = await fetch(url, { headers: HEADERS, signal: sig });
        if (!resp.ok) continue;
        const payload = await resp.json();
        const rows = payload?.quoteResponse?.result;
        if (!Array.isArray(rows) || !rows.length) continue;
        return rows[0];
      } catch {
        /* try next host */
      }
    }
    return null;
  } finally {
    clear();
  }
}

async function fetchYahooChartResponse(symbol, { signal } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  const { signal: sig, clear } = effectiveSignal(signal);
  const useProxy = !import.meta.env?.DEV && typeof window !== 'undefined';
  const chartPath = `/v8/finance/chart/${encodeURIComponent(sym)}?${CHART_QS}`;
  const targets = useProxy
    ? [chartFetchUrl(sym)]
    : YAHOO_HOSTS.map((host) => `https://${host}${chartPath}`);

  let lastResp = null;
  try {
    for (const url of targets) {
      try {
        const resp = await fetch(url, { headers: HEADERS, signal: sig });
        lastResp = resp;
        if (resp.ok) return resp;
        if (!RETRY_HTTP_STATUSES.has(resp.status)) return resp;
      } catch {
        /* next */
      }
    }
    return lastResp;
  } finally {
    clear();
  }
}

/** Overlay v7 quote fields onto chart meta (Yahoo extended always wins over Stooq). */
function mergeQuoteSummaryIntoMeta(chartMeta, summaryRow) {
  if (!summaryRow) return chartMeta || {};
  const chartIsYahoo = chartMeta && !isStooqFallbackMeta(chartMeta);
  const summaryIsStooq = isStooqFallbackMeta(summaryRow);
  const out = { ...(chartMeta || {}) };
  for (const key of QUOTE_SUMMARY_KEYS) {
    if (summaryRow[key] == null) continue;
    if (summaryIsStooq && chartIsYahoo && YAHOO_EXTENDED_FIELD_KEYS.includes(key)) {
      continue;
    }
    out[key] = summaryRow[key];
  }
  if (summaryRow.regularMarketPreviousClose != null) {
    out.regularMarketPreviousClose = summaryRow.regularMarketPreviousClose;
  }
  if (chartIsYahoo) {
    return mergeYahooExtendedFields(out, chartMeta);
  }
  return out;
}

function float(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function yahooChangePct(v) {
  if (v == null) return null;
  // Chart meta is usually already percent (1.48 = 1.48%). Scale only clear fractions (|v| < 0.25).
  if (Math.abs(v) > 0 && Math.abs(v) < 0.25) return v * 100;
  return v;
}

function deriveChangePct(price, base) {
  if (price == null || base == null || base === 0) return null;
  return ((price - base) / base) * 100;
}

/** Yahoo quote page uses regularMarketPreviousClose; chartPreviousClose can be stale on big-move days. */
const CHART_PREV_MAX_DRIFT = 0.12;

function resolvePreviousClose(meta, regularPrice, now = new Date()) {
  const chartPrev = float(meta.chartPreviousClose);
  const metaPrev = float(meta.previousClose);
  const regMktPrev = float(meta.regularMarketPreviousClose);
  const marketState = String(meta.marketState || '').trim().toUpperCase();
  const inPre = marketState === 'PRE' || marketState === 'PREPRE';
  const clockPre = closedExtendedModeByClock(now) === 'pre';
  const offRth = !isUsRegularSessionByClock(now);
  const regPx = float(meta.regularMarketPrice);
  const prePx =
    float(meta.preMarketPrice)
    ?? ((inPre || clockPre) ? float(meta.currentPrice) : null);

  const isPost =
    marketState === 'POST' || marketState === 'POSTPOST' || marketState === 'CLOSED';
  if ((inPre || clockPre || (offRth && marketState === 'REGULAR')) && !isPost && regPx != null && prePx != null) {
  const wirePrev = metaPrev ?? chartPrev;
  const wireLooksStale =
    wirePrev != null && regPx < wirePrev * 0.97 && Math.abs(regPx - prePx) / prePx > 0.005;
  if (wireLooksStale || (regPx > prePx && Math.abs(regPx - prePx) / prePx > 0.005)) {
      // During PRE, regularMarketPrice is often prior close (138.47) while previousClose lags (145.54).
      if (regMktPrev != null && Math.abs(regPx - regMktPrev) / regMktPrev < 0.03) {
        return regMktPrev;
      }
      return regPx;
    }
  }

  const preChg = float(meta.preMarketChange);
  let derivedFromPre = null;
  if (prePx != null && preChg != null) {
    const d = prePx - preChg;
    if (d > 0) derivedFromPre = d;
  }

  // v7 regularMarketPreviousClose wins; chart/previousClose on the wire can be stale (e.g. MRVL 145.54 vs 138.47).
  let previousClose = regMktPrev ?? derivedFromPre;

  if (
    metaPrev != null
    && previousClose != null
    && Math.abs(metaPrev - previousClose) / previousClose > 0.02
  ) {
    // Ignore disagreeing meta.previousClose (often chart echo ~145).
  } else if (previousClose == null) {
    previousClose = metaPrev;
  }

  const chg = float(meta.regularMarketChange);
  const trustFromChangeHeuristic = regMktPrev == null && derivedFromPre == null && !inPre;

  if (trustFromChangeHeuristic && previousClose == null && regularPrice != null && chg != null) {
    const fromChange = regularPrice - chg;
    if (fromChange > 0) previousClose = fromChange;
  }

  if (chartPrev != null && regMktPrev == null && derivedFromPre == null) {
    if (previousClose == null) {
      if (
        metaPrev == null
        || Math.abs(chartPrev - metaPrev) / metaPrev <= CHART_PREV_MAX_DRIFT
      ) {
        previousClose = chartPrev;
      }
    }
  }

  if (
    trustFromChangeHeuristic
    && previousClose != null
    && regularPrice != null
    && chg != null
  ) {
    const fromChange = regularPrice - chg;
    if (fromChange > 0) {
      const drift = Math.abs(fromChange - previousClose) / previousClose;
      if (drift > 0.02 && drift <= CHART_PREV_MAX_DRIFT) {
        previousClose = fromChange;
      }
    }
  }

  return previousClose;
}

/**
 * Watchlist/footer “Previous Close” = last completed regular session (at close)
 * during pre/post/closed; during live US regular, prior trading day close.
 */
export function resolveDisplayPreviousClose(priorSessionClose, regularPrice, marketState) {
  const state = String(marketState || '').trim().toUpperCase();
  const clockRegular = isUsRegularSessionByClock(new Date());
  if (state === 'REGULAR' && clockRegular && priorSessionClose != null) {
    return priorSessionClose;
  }
  if (regularPrice != null) return regularPrice;
  return priorSessionClose;
}

/** Chart meta occasionally leaves regularMarketPrice at prior close while change fields moved. */
function resolveRegularMarketPrice(meta, previousClose) {
  let regularPrice = float(meta.regularMarketPrice);
  if (regularPrice == null || previousClose == null || previousClose <= 0) return regularPrice;

  const marketState = String(meta.marketState || '').trim().toUpperCase();
  const inPre = marketState === 'PRE' || marketState === 'PREPRE';
  if (inPre) return regularPrice;

  const chg = float(meta.regularMarketChange);
  const chgPct = yahooChangePct(float(meta.regularMarketChangePercent));
  const stuckAtPrior = Math.abs(regularPrice - previousClose) / previousClose < 0.015;

  if (stuckAtPrior && chg != null && Math.abs(chg) > 0.01) {
    const lifted = previousClose + chg;
    if (lifted > 0 && Math.abs(lifted - previousClose) / previousClose > 0.03) {
      regularPrice = lifted;
    }
  } else if (stuckAtPrior && chgPct != null && Math.abs(chgPct) > 3) {
    const lifted = previousClose * (1 + chgPct / 100);
    if (Number.isFinite(lifted) && lifted > 0) regularPrice = lifted;
  }

  return regularPrice;
}

/** Align absolute change sign with derived percentage. */
function alignChangeAbsWithPct(changeAbs, changePct) {
  if (changeAbs == null || changePct == null) return changeAbs;
  const abs = Number(changeAbs);
  const pct = Number(changePct);
  if (!Number.isFinite(abs) || !Number.isFinite(pct)) return changeAbs;
  if (pct === 0) return 0;
  if (pct > 0 && abs < 0) return Math.abs(abs);
  if (pct < 0 && abs > 0) return -Math.abs(abs);
  return abs;
}

function deriveRegularChangeAbs(regularPrice, previousClose, regularChangePct, metaChange) {
  let abs = float(metaChange);
  if (abs == null && regularPrice != null && previousClose != null) {
    abs = regularPrice - previousClose;
  }
  if (abs == null && regularChangePct != null && previousClose != null) {
    abs = (regularChangePct / 100) * previousClose;
  }
  if (abs == null && regularChangePct != null && regularPrice != null && previousClose == null) {
    const prior = regularPrice / (1 + regularChangePct / 100);
    if (Number.isFinite(prior)) abs = regularPrice - prior;
  }
  return alignChangeAbsWithPct(abs, regularChangePct);
}

/**
 * Map merged Yahoo meta → app quote row (unit-testable; used after chart + v7 merge).
 */
export function mapYahooMetaToQuote(meta, sym, chartResult, opts = {}) {
  const symbol = sym || meta.symbol || '';
  const now = opts.now ?? new Date();

  const regMktPrevPinned = float(meta.regularMarketPreviousClose);
  const provisionalPrev = regMktPrevPinned ?? resolvePreviousClose(meta, float(meta.regularMarketPrice), now);
  const regularPrice = resolveRegularMarketPrice(meta, provisionalPrev);
  let premarketPrice = float(meta.preMarketPrice);
  let regularChangePct = yahooChangePct(float(meta.regularMarketChangePercent));
  if (regularChangePct == null) {
    regularChangePct = deriveChangePct(regularPrice, provisionalPrev);
  }
  const priorSessionClose = regMktPrevPinned ?? resolvePreviousClose(meta, regularPrice, now);
  const displayPreviousClose = resolveDisplayPreviousClose(
    priorSessionClose,
    regularPrice,
    String(meta.marketState || ''),
  );
  const extendedBase = regularPrice ?? priorSessionClose;
  const regularFromPrev = deriveChangePct(regularPrice, priorSessionClose);
  if (regularFromPrev != null) regularChangePct = regularFromPrev;
  let premarketChangePct = yahooChangePct(float(meta.preMarketChangePercent));
  if (premarketChangePct == null && premarketPrice != null && extendedBase != null) {
    premarketChangePct = deriveChangePct(premarketPrice, extendedBase);
  }
  let premarketChangeAbs = float(meta.preMarketChange);
  if (premarketChangeAbs == null && premarketPrice != null && extendedBase != null) {
    premarketChangeAbs = premarketPrice - extendedBase;
  }
  premarketChangeAbs = alignChangeAbsWithPct(premarketChangeAbs, premarketChangePct);

  const marketState = String(meta.marketState || '').trim().toUpperCase();
  let currentPrice = float(meta.currentPrice);
  let postmarketPrice = float(meta.postMarketPrice);
  if (postmarketPrice == null && (marketState === 'POST' || marketState === 'POSTPOST')) {
    if (currentPrice != null && currentPrice !== regularPrice) postmarketPrice = currentPrice;
  }
  // Yahoo often keeps marketState REGULAR after the close while currentPrice tracks after-hours.
  if (
    postmarketPrice == null
    && marketState === 'REGULAR'
    && currentPrice != null
    && regularPrice != null
    && currentPrice !== regularPrice
  ) {
    postmarketPrice = currentPrice;
  }
  if (postmarketPrice == null && (marketState === 'POST' || marketState === 'POSTPOST' || marketState === 'CLOSED')) {
    const closes = chartResult?.indicators?.quote?.[0]?.close;
    if (Array.isArray(closes)) {
      for (let i = closes.length - 1; i >= 0; i -= 1) {
        const c = float(closes[i]);
        if (c != null && c !== regularPrice) {
          postmarketPrice = c;
          break;
        }
      }
    }
  }
  if (
    premarketPrice == null
    && (marketState === 'PRE' || marketState === 'PREPRE')
    && currentPrice != null
    && regularPrice != null
    && currentPrice !== regularPrice
  ) {
    premarketPrice = currentPrice;
    if (premarketChangePct == null && extendedBase != null) {
      premarketChangePct = deriveChangePct(premarketPrice, extendedBase);
    }
    if (premarketChangeAbs == null && extendedBase != null) {
      premarketChangeAbs = premarketPrice - extendedBase;
    }
    premarketChangeAbs = alignChangeAbsWithPct(premarketChangeAbs, premarketChangePct);
  }
  // Yahoo chart v8 often omits postMarketPrice; fulldayPrice is the live extended tick (see MRVL meta).
  const fulldayPrice = float(meta.fulldayPrice);
  if (currentPrice == null && fulldayPrice != null) {
    currentPrice = fulldayPrice;
  }
  const preSession = marketState === 'PRE' || marketState === 'PREPRE';
  const clockPre = closedExtendedModeByClock(now) === 'pre';
  if (
    regularPrice != null
    && fulldayPrice != null
    && Math.abs(fulldayPrice - regularPrice) >= 0.01
  ) {
    if (postmarketPrice == null && !preSession) postmarketPrice = fulldayPrice;
    if (premarketPrice == null && (preSession || clockPre)) premarketPrice = fulldayPrice;
  }

  if ((preSession || clockPre) && premarketPrice != null && extendedBase != null) {
    premarketChangePct = deriveChangePct(premarketPrice, extendedBase);
    premarketChangeAbs = premarketPrice - extendedBase;
    premarketChangeAbs = alignChangeAbsWithPct(premarketChangeAbs, premarketChangePct);
  }

  // Morning pre fields are meaningless after the open; after-hours UI must not reuse them.
  if (!preSession && !clockPre) {
    premarketPrice = null;
    premarketChangePct = null;
    premarketChangeAbs = null;
  }

  let postmarketChangePct = yahooChangePct(float(meta.postMarketChangePercent));
  let postmarketChangeAbs = float(meta.postMarketChange);
  if (postmarketPrice != null && extendedBase != null) {
    const derivedPct = deriveChangePct(postmarketPrice, extendedBase);
    if (derivedPct != null) postmarketChangePct = derivedPct;
    if (postmarketChangeAbs == null) postmarketChangeAbs = postmarketPrice - extendedBase;
    postmarketChangeAbs = alignChangeAbsWithPct(postmarketChangeAbs, postmarketChangePct);
  }

  const regularChangeAbs = deriveRegularChangeAbs(
    regularPrice,
    priorSessionClose,
    regularChangePct,
    meta.regularMarketChange,
  );

  return sanitizeQuotePrices({
    symbol: meta.symbol || symbol,
    currency: meta.currency || (String(symbol).endsWith('.KS') ? 'KRW' : 'USD'),
    market_state: meta.marketState || '',
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    previous_close: displayPreviousClose,
    regular_price: regularPrice,
    regular_change_abs: regularChangeAbs,
    regular_change_pct: regularChangePct,
    current_price: currentPrice,
    premarket_price: premarketPrice,
    premarket_change_pct: premarketChangePct,
    premarket_change_abs: premarketChangeAbs,
    postmarket_price: postmarketPrice,
    postmarket_change_pct: postmarketChangePct,
    postmarket_change_abs: postmarketChangeAbs,
    fullday_price: fulldayPrice,
    regular_market_open: float(meta.regularMarketOpen),
    day_high: float(meta.regularMarketDayHigh),
    day_low: float(meta.regularMarketDayLow),
    fifty_two_week_high: float(meta.fiftyTwoWeekHigh),
    fifty_two_week_low: float(meta.fiftyTwoWeekLow),
    regular_market_time: float(meta.regularMarketTime),
    pre_market_time: float(meta.preMarketTime),
    post_market_time: float(meta.postMarketTime),
    source: 'yahoo_finance',
    chart_result: chartResult ?? null,
  });
}

/**
 * Yahoo chart + v7 quote (same shape as ILM backend stock_quote.fetch_yahoo_quote).
 * Dev: direct Yahoo. Production: /api/quote + /api/quote-summary proxies on Vercel.
 */
export async function fetchYahooQuote(symbol, { signal } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) throw new Error('symbol required');
  const [chartResp, summaryRow] = await Promise.all([
    fetchYahooChartResponse(sym, { signal }),
    fetchYahooQuoteSummaryRow(sym, { signal }),
  ]);
  let quote = await buildQuoteFromChartAndSummary(sym, chartResp, summaryRow);
  if (quoteIsRenderable(quote)) return quote;
  if (!summaryRow) {
    const retrySummary = await fetchYahooQuoteSummaryRow(sym, { signal });
    quote = await buildQuoteFromChartAndSummary(sym, chartResp, retrySummary);
    if (quoteIsRenderable(quote)) return quote;
  }
  if (chartResp?.ok === false) throw new Error(`Yahoo HTTP ${chartResp.status}`);
  if (chartResp == null) throw new Error('Yahoo HTTP 500');
  throw new Error('No quote data');
}

async function buildQuoteFromChartAndSummary(sym, chartResp, summaryRow) {
  let quote = null;
  if (chartResp?.ok) {
    const payload = await chartResp.json();
    const results = payload?.chart?.result || [];
    if (results.length) {
      const meta = mergeQuoteSummaryIntoMeta(results[0].meta || {}, summaryRow);
      quote = mapYahooMetaToQuote(meta, sym, results[0]);
    }
  }
  if (!quoteIsRenderable(quote) && summaryRow) {
    const chartMeta = quote?.chart_result?.meta ?? {};
    const meta = mergeQuoteSummaryIntoMeta(chartMeta, summaryRow);
    quote = mapYahooMetaToQuote(meta, sym, quote?.chart_result ?? null);
  }
  return quote;
}

function watchlistRowFromQuote(label, symbol, quote) {
  const q = sanitizeQuotePrices(quote);
  return {
    name: symbol,
    label,
    status: 'done',
    currency: q.currency,
    previous_close: q.previous_close,
    regular_price: q.regular_price,
    regular_change_abs: q.regular_change_abs,
    regular_change_pct: q.regular_change_pct,
    premarket_price: q.premarket_price,
    premarket_change_pct: q.premarket_change_pct,
    premarket_change_abs: q.premarket_change_abs,
    postmarket_price: q.postmarket_price,
    postmarket_change_pct: q.postmarket_change_pct,
    postmarket_change_abs: q.postmarket_change_abs,
    current_price: q.current_price,
    fullday_price: q.fullday_price,
    market_state: q.market_state,
    exchange: q.exchange,
  };
}

async function fetchWatchlistViaBatch(entries, onProgress) {
  const symbols = entries.map(([, s]) => String(s).trim().toUpperCase());
  const batchUrl = quotesBatchFetchUrl(symbols);
  if (!batchUrl) return null;
  const items = entries.map(([label, symbol]) => ({
    name: symbol,
    label,
    status: 'pending',
  }));
  onProgress?.([...items]);
  const { signal, clear } = clientFetchTimeout(Math.max(CLIENT_FETCH_TIMEOUT_MS, 25_000));
  try {
    const resp = await fetch(batchUrl, { headers: HEADERS, signal });
    if (!resp.ok) return null;
    const payload = await resp.json();
    const rows = payload?.quoteResponse?.result;
    if (!Array.isArray(rows) || !rows.length) return null;
    const bySym = new Map();
    for (const row of rows) {
      const sym = String(row?.symbol || '').trim().toUpperCase();
      if (sym) bySym.set(sym, row);
    }
    for (let i = 0; i < entries.length; i += 1) {
      const [label, symbol] = entries[i];
      const sym = String(symbol).trim().toUpperCase();
      const row = bySym.get(sym);
      if (!row) {
        items[i] = { name: symbol, label, status: 'failed', error: 'No batch row' };
        continue;
      }
      try {
        const quote = mapYahooMetaToQuote(row, sym, null);
        if (!quoteIsRenderable(quote)) throw new Error('No quote data');
        items[i] = watchlistRowFromQuote(label, symbol, quote);
      } catch (ex) {
        items[i] = {
          name: symbol,
          label,
          status: 'failed',
          error: String(ex.message || ex),
        };
      }
      onProgress?.([...items]);
    }
    return items;
  } catch {
    return null;
  } finally {
    clear();
  }
}

const MAX_PARALLEL = 3;

export async function fetchWatchlistQuotes(entries, onProgress) {
  const batched = await fetchWatchlistViaBatch(entries, onProgress);
  if (batched) {
    const failedIdx = batched
      .map((it, i) => (it.status === 'failed' ? i : -1))
      .filter((i) => i >= 0);
    if (!failedIdx.length) return batched;
    for (const i of failedIdx) {
      const [label, symbol] = entries[i];
      try {
        const quote = sanitizeQuotePrices(await fetchYahooQuote(symbol));
        batched[i] = watchlistRowFromQuote(label, symbol, quote);
      } catch (ex) {
        batched[i] = {
          name: symbol,
          label,
          status: 'failed',
          error: String(ex.message || ex),
        };
      }
      onProgress?.([...batched]);
    }
    return batched;
  }

  const items = entries.map(([label, symbol]) => ({
    name: symbol,
    label,
    status: 'pending',
  }));
  onProgress?.([...items]);

  let idx = 0;
  async function worker() {
    while (idx < entries.length) {
      const i = idx;
      idx += 1;
      const [label, symbol] = entries[i];
      try {
        const quote = sanitizeQuotePrices(await fetchYahooQuote(symbol));
        items[i] = watchlistRowFromQuote(label, symbol, quote);
      } catch (ex) {
        items[i] = {
          name: symbol,
          label,
          status: 'failed',
          error: String(ex.message || ex),
        };
      }
      onProgress?.([...items]);
    }
  }

  const workers = Array.from({ length: Math.min(MAX_PARALLEL, entries.length) }, () => worker());
  await Promise.all(workers);
  return items;
}

export async function fetchMrvlQuote() {
  return fetchYahooQuote('MRVL');
}

export { resolvePreviousClose, resolveRegularMarketPrice };

function normalizeUsdInrRate(quote) {
  const sym = String(quote.symbol || '').toUpperCase();
  if (sym !== 'INR=X') {
    throw new Error(`USD/INR must use INR=X (got ${sym || '?'})`);
  }
  const cur = String(quote.currency || '').toUpperCase();
  if (cur === 'KRW' || cur === 'JPY') {
    throw new Error(`Wrong FX currency ${cur} for INR=X`);
  }
  let rate = quote.regular_price;
  if (rate == null) throw new Error('USD/INR price missing');
  if (rate > 0 && rate < 2) rate = 1 / rate;
  // Spot USD/INR sanity band (INR=X); reject obvious wrong-pair reads (e.g. KRW ~1300).
  if (rate < 80 || rate > 110) {
    throw new Error(`USD/INR out of range (${rate}) — expected INR=X spot`);
  }
  return rate;
}

export async function fetchUsdInrRate({ signal } = {}) {
  const q = await fetchYahooQuote('INR=X', { signal });
  const rate = normalizeUsdInrRate(q);
  return {
    pair: 'USD/INR',
    rate,
    change_pct: q.regular_change_pct,
    fetched_at: Date.now(),
  };
}
