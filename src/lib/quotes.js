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
  if (Math.abs(v) < 1.5) return v * 100;
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
  let regularChangePct = yahooChangePct(float(meta.regularMarketChangePercent));
  let premarketChangePct = yahooChangePct(float(meta.preMarketChangePercent));
  if (regularChangePct == null) {
    regularChangePct = deriveChangePct(regularPrice, previousClose);
  }
  if (premarketChangePct == null && premarketPrice != null) {
    const base = regularPrice ?? previousClose;
    premarketChangePct = deriveChangePct(premarketPrice, base);
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
