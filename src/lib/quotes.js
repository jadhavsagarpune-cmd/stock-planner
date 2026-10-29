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
  const premarketPrice = float(meta.preMarketPrice);
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
  let postmarketPrice = float(meta.postMarketPrice);
  if (postmarketPrice == null && (marketState === 'POST' || marketState === 'POSTPOST')) {
    const current = float(meta.currentPrice);
    if (current != null && current !== regularPrice) postmarketPrice = current;
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
    premarket_price: premarketPrice,
    premarket_change_pct: premarketChangePct,
    postmarket_price: postmarketPrice,
    postmarket_change_pct: postmarketChangePct,
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
  if (sym.includes('KRW') || sym.includes('JPY=X')) {
    throw new Error(`Wrong FX symbol ${sym}`);
  }
  let rate = quote.regular_price;
  if (rate == null) throw new Error('USD/INR price missing');
  if (rate > 0 && rate < 2) rate = 1 / rate;
  if (rate < 60 || rate > 130) throw new Error(`USD/INR out of range (${rate})`);
  return rate;
}

export async function fetchUsdInrRate({ signal } = {}) {
  let lastErr;
  for (const symbol of ['INR=X', 'USDINR=X']) {
    try {
      const q = await fetchYahooQuote(symbol, { signal });
      const rate = normalizeUsdInrRate(q);
      return {
        pair: 'USD/INR',
        rate,
        change_pct: q.regular_change_pct,
        fetched_at: Date.now(),
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('USD/INR unavailable');
}
