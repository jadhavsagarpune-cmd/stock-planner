const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';
const HEADERS = {
  Accept: 'application/json',
};

/** Production (Vercel): same-origin proxy avoids browser CORS blocks on Yahoo. */
function chartFetchUrl(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  const qs = 'interval=1m&range=1d';
  if (import.meta.env.DEV) {
    return `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(sym))}?${qs}`;
  }
  return `/api/quote?symbol=${encodeURIComponent(sym)}`;
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

  const regularPrice = float(meta.regularMarketPrice);
  let premarketPrice = float(meta.preMarketPrice);
  const previousClose = float(meta.chartPreviousClose) ?? float(meta.previousClose);
  let regularChangePct = deriveChangePct(regularPrice, previousClose);
  if (regularChangePct == null) {
    regularChangePct = yahooChangePct(float(meta.regularMarketChangePercent));
  }
  let premarketChangePct = null;
  if (premarketPrice != null) {
    const preBase = regularPrice ?? previousClose;
    premarketChangePct = deriveChangePct(premarketPrice, preBase);
  }
  if (premarketChangePct == null) {
    premarketChangePct = yahooChangePct(float(meta.preMarketChangePercent));
  }

  const marketState = String(meta.marketState || '').trim().toUpperCase();
  const currentPrice = float(meta.currentPrice);
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
    premarketChangePct = deriveChangePct(premarketPrice, regularPrice);
  }
  if (
    premarketPrice == null
    && marketState === 'REGULAR'
    && currentPrice != null
    && regularPrice != null
    && currentPrice !== regularPrice
    && postmarketPrice == null
  ) {
    premarketPrice = currentPrice;
    premarketChangePct = deriveChangePct(premarketPrice, regularPrice);
  }

  // Yahoo chart v8 often omits postMarketPrice; fulldayPrice is the live extended tick (see MRVL meta).
  const fulldayPrice = float(meta.fulldayPrice);
  if (currentPrice == null && fulldayPrice != null) {
    currentPrice = fulldayPrice;
  }
  if (
    regularPrice != null
    && fulldayPrice != null
    && Math.abs(fulldayPrice - regularPrice) >= 0.01
  ) {
    if (postmarketPrice == null) postmarketPrice = fulldayPrice;
    if (premarketPrice == null) premarketPrice = fulldayPrice;
  }

  let postmarketChangePct = deriveChangePct(postmarketPrice, regularPrice);
  if (postmarketChangePct == null) {
    postmarketChangePct = yahooChangePct(float(meta.postMarketChangePercent));
  }

  return {
    symbol: meta.symbol || sym,
    currency: meta.currency || (sym.endsWith('.KS') ? 'KRW' : 'USD'),
    market_state: meta.marketState || '',
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    regular_price: regularPrice,
    regular_change_pct: regularChangePct,
    current_price: currentPrice,
    premarket_price: premarketPrice,
    premarket_change_pct: premarketChangePct,
    postmarket_price: postmarketPrice,
    postmarket_change_pct: postmarketChangePct,
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
          regular_price: quote.regular_price,
          regular_change_pct: quote.regular_change_pct,
          premarket_price: quote.premarket_price,
          premarket_change_pct: quote.premarket_change_pct,
          postmarket_price: quote.postmarket_price,
          postmarket_change_pct: quote.postmarket_change_pct,
          current_price: quote.current_price,
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
  // Spot USD/INR ~76–92; ~95 is typically a wrong pair (e.g. KRW misread).
  if (rate < 75 || rate > 92) {
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
