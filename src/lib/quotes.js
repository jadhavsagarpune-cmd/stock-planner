const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const CHART_QS = 'interval=1m&range=1d&includePrePost=true';

/** Production (Vercel): same-origin proxy avoids browser CORS blocks on Yahoo. */
function chartFetchUrl(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  const direct = `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(sym))}?${CHART_QS}`;
  if (import.meta.env?.DEV) return direct;
  if (typeof window === 'undefined') return direct;
  return `/api/quote?symbol=${encodeURIComponent(sym)}&${CHART_QS}`;
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

function resolvePreviousClose(meta, regularPrice) {
  const chartPrev = float(meta.chartPreviousClose);
  const metaPrev = float(meta.previousClose);
  const regMktPrev = float(meta.regularMarketPreviousClose);
  let previousClose = regMktPrev ?? metaPrev;

  const chg = float(meta.regularMarketChange);
  if (previousClose == null && regularPrice != null && chg != null) {
    const fromChange = regularPrice - chg;
    if (fromChange > 0) previousClose = fromChange;
  }

  if (chartPrev != null) {
    if (previousClose == null) {
      previousClose = chartPrev;
    } else if (Math.abs(chartPrev - previousClose) / previousClose > CHART_PREV_MAX_DRIFT) {
      // e.g. ADBE chartPreviousClose ~338 while quote prior ~138 — ignore chart field
    }
  }

  if (previousClose != null && regularPrice != null && chg != null) {
    const fromChange = regularPrice - chg;
    if (fromChange > 0) {
      const drift = Math.abs(fromChange - previousClose) / previousClose;
      if (drift > 0.02 && drift <= CHART_PREV_MAX_DRIFT) {
        previousClose = fromChange;
      } else if (
        drift > CHART_PREV_MAX_DRIFT
        && regMktPrev != null
        && Math.abs(fromChange - regMktPrev) / regMktPrev < 0.02
      ) {
        previousClose = regMktPrev;
      }
    }
  }

  return previousClose;
}

/** Chart meta occasionally leaves regularMarketPrice at prior close while change fields moved. */
function resolveRegularMarketPrice(meta, previousClose) {
  let regularPrice = float(meta.regularMarketPrice);
  if (regularPrice == null || previousClose == null || previousClose <= 0) return regularPrice;

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
 * Yahoo chart quote (same shape as ILM backend stock_quote.fetch_yahoo_quote).
 * Dev: direct Yahoo. Production: /api/quote serverless proxy on Vercel.
 */
export async function fetchYahooQuote(symbol, { signal } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) throw new Error('symbol required');
  const resp = await fetch(chartFetchUrl(sym), {
    headers: HEADERS,
    signal,
  });
  if (!resp.ok) throw new Error(`Yahoo HTTP ${resp.status}`);
  const payload = await resp.json();
  const results = payload?.chart?.result || [];
  if (!results.length) throw new Error('No quote data');
  const meta = results[0].meta || {};

  const provisionalPrev = resolvePreviousClose(meta, float(meta.regularMarketPrice));
  const regularPrice = resolveRegularMarketPrice(meta, provisionalPrev);
  let premarketPrice = float(meta.preMarketPrice);
  let regularChangePct = yahooChangePct(float(meta.regularMarketChangePercent));
  if (regularChangePct == null) {
    regularChangePct = deriveChangePct(regularPrice, provisionalPrev);
  }
  const previousClose = resolvePreviousClose(meta, regularPrice);
  const regularFromPrev = deriveChangePct(regularPrice, previousClose);
  if (regularFromPrev != null) regularChangePct = regularFromPrev;
  let premarketChangePct = yahooChangePct(float(meta.preMarketChangePercent));
  if (premarketChangePct == null && premarketPrice != null && previousClose != null) {
    premarketChangePct = deriveChangePct(premarketPrice, previousClose);
  }
  let premarketChangeAbs = float(meta.preMarketChange);
  if (premarketChangeAbs == null && premarketPrice != null && previousClose != null) {
    premarketChangeAbs = premarketPrice - previousClose;
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
    const closes = results[0]?.indicators?.quote?.[0]?.close;
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
    if (premarketChangePct == null && previousClose != null) {
      premarketChangePct = deriveChangePct(premarketPrice, previousClose);
    }
    if (premarketChangeAbs == null && previousClose != null) {
      premarketChangeAbs = premarketPrice - previousClose;
    }
    premarketChangeAbs = alignChangeAbsWithPct(premarketChangeAbs, premarketChangePct);
  }
  // Yahoo chart v8 often omits postMarketPrice; fulldayPrice is the live extended tick (see MRVL meta).
  const fulldayPrice = float(meta.fulldayPrice);
  if (currentPrice == null && fulldayPrice != null) {
    currentPrice = fulldayPrice;
  }
  const preSession = marketState === 'PRE' || marketState === 'PREPRE';
  if (
    regularPrice != null
    && fulldayPrice != null
    && Math.abs(fulldayPrice - regularPrice) >= 0.01
  ) {
    if (postmarketPrice == null && !preSession) postmarketPrice = fulldayPrice;
    if (premarketPrice == null && preSession) premarketPrice = fulldayPrice;
  }

  if (preSession && premarketPrice != null && previousClose != null) {
    premarketChangePct = deriveChangePct(premarketPrice, previousClose);
    premarketChangeAbs = premarketPrice - previousClose;
    premarketChangeAbs = alignChangeAbsWithPct(premarketChangeAbs, premarketChangePct);
  }

  // Morning pre fields are meaningless after the open; after-hours UI must not reuse them.
  if (!preSession) {
    premarketPrice = null;
    premarketChangePct = null;
    premarketChangeAbs = null;
  }

  let postmarketChangePct = null;
  let postmarketChangeAbs = null;
  if (postmarketPrice != null && previousClose != null) {
    postmarketChangePct = deriveChangePct(postmarketPrice, previousClose);
    postmarketChangeAbs = postmarketPrice - previousClose;
    postmarketChangeAbs = alignChangeAbsWithPct(postmarketChangeAbs, postmarketChangePct);
  } else if (postmarketPrice != null) {
    postmarketChangePct = yahooChangePct(float(meta.postMarketChangePercent));
    postmarketChangeAbs = float(meta.postMarketChange);
    postmarketChangeAbs = alignChangeAbsWithPct(postmarketChangeAbs, postmarketChangePct);
  }

  const regularChangeAbs = deriveRegularChangeAbs(
    regularPrice,
    previousClose,
    regularChangePct,
    meta.regularMarketChange,
  );

  return {
    symbol: meta.symbol || sym,
    currency: meta.currency || (sym.endsWith('.KS') ? 'KRW' : 'USD'),
    market_state: meta.marketState || '',
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    previous_close: previousClose,
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
    source: 'yahoo_finance',
  };
}

const MAX_PARALLEL = 6;

export async function fetchWatchlistQuotes(entries, onProgress) {
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
        const quote = await fetchYahooQuote(symbol);
        items[i] = {
          name: symbol,
          label,
          status: 'done',
          currency: quote.currency,
          previous_close: quote.previous_close,
          regular_price: quote.regular_price,
          regular_change_abs: quote.regular_change_abs,
          regular_change_pct: quote.regular_change_pct,
          premarket_price: quote.premarket_price,
          premarket_change_pct: quote.premarket_change_pct,
          premarket_change_abs: quote.premarket_change_abs,
          postmarket_price: quote.postmarket_price,
          postmarket_change_pct: quote.postmarket_change_pct,
          postmarket_change_abs: quote.postmarket_change_abs,
          current_price: quote.current_price,
          fullday_price: quote.fullday_price,
          market_state: quote.market_state,
          exchange: quote.exchange,
        };
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
