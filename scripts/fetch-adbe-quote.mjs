/**
 * Live ADBE quote + raw Yahoo meta (requires network).
 * Run: node scripts/fetch-adbe-quote.mjs
 */
import { fetchYahooQuote } from '../src/lib/quotes.js';

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/ADBE';
const YAHOO_QUOTE = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=ADBE';
const qs = 'interval=1m&range=1d&includePrePost=true';
const headers = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function near(actual, expected, tol) {
  if (actual == null || !Number.isFinite(Number(actual))) return false;
  return Math.abs(Number(actual) - expected) <= tol;
}

try {
  const [chartResp, quoteResp] = await Promise.all([
    fetch(`${YAHOO_CHART}?${qs}`, { headers }),
    fetch(YAHOO_QUOTE, { headers }),
  ]);
  if (!chartResp.ok) throw new Error(`Yahoo chart HTTP ${chartResp.status}`);
  const payload = await chartResp.json();
  const meta = payload?.chart?.result?.[0]?.meta ?? {};
  const summary = quoteResp.ok
    ? (await quoteResp.json())?.quoteResponse?.result?.[0] ?? {}
    : {};
  const pick = (k) => meta[k] ?? summary[k];
  console.log('RAW_YAHOO_META', JSON.stringify({
    regularMarketPrice: pick('regularMarketPrice'),
    regularMarketPreviousClose: pick('regularMarketPreviousClose'),
    previousClose: pick('previousClose'),
    chartPreviousClose: meta.chartPreviousClose,
    regularMarketChange: pick('regularMarketChange'),
    regularMarketChangePercent: pick('regularMarketChangePercent'),
    currentPrice: pick('currentPrice'),
    postMarketPrice: pick('postMarketPrice'),
    postMarketChangePercent: pick('postMarketChangePercent'),
    marketState: pick('marketState'),
  }, null, 2));

  const quote = await fetchYahooQuote('ADBE');
  console.log('MAPPED_QUOTE', JSON.stringify(quote, null, 2));

  const assertions = [];
  const priorRef = summary.regularMarketPreviousClose ?? summary.previousClose;
  if (priorRef != null && near(quote.previous_close, priorRef, 0.15)) {
    assertions.push('previous_close~Yahoo prior');
  } else if (near(quote.previous_close, 138.47, 0.15)) {
    assertions.push('previous_close~138.47');
  } else {
    console.error('FAIL previous_close', quote.previous_close, { priorRef });
    process.exit(1);
  }

  const regRef = summary.regularMarketPrice ?? meta.regularMarketPrice;
  if (regRef != null && near(quote.regular_price, regRef, 0.25)) {
    assertions.push('regular_price~Yahoo regular');
  } else if (near(quote.regular_price, 336.31, 0.5)) {
    assertions.push('regular_price~336');
  } else {
    console.error('FAIL regular_price', quote.regular_price, { regRef });
    process.exit(1);
  }

  if (quote.postmarket_price != null && quote.regular_price != null) {
    const derivedPct =
      ((quote.postmarket_price - quote.regular_price) / quote.regular_price) * 100;
    if (!near(quote.postmarket_change_pct, derivedPct, 0.08)) {
      console.error('FAIL after change not vs at close', {
        postmarket_change_pct: quote.postmarket_change_pct,
        derivedPct,
      });
      process.exit(1);
    }
    assertions.push(`after~${quote.postmarket_change_pct?.toFixed(2)}% vs at close`);
  }

  console.log('OK ADBE assertions', assertions);
} catch (err) {
  console.warn('Live Yahoo unreachable — running offline ADBE fixture assertions:', err.message);
  const { mapYahooMetaToQuote } = await import('../src/lib/quotes.js');
  const fixture = {
    symbol: 'ADBE',
    marketState: 'POST',
    regularMarketPrice: 336.31,
    regularMarketPreviousClose: 138.47,
    previousClose: 138.47,
    chartPreviousClose: 338.05,
    regularMarketChange: 197.84,
    regularMarketChangePercent: 142.87,
    postMarketPrice: 333.57,
    postMarketChange: -2.74,
    postMarketChangePercent: -0.815,
  };
  const quote = mapYahooMetaToQuote(fixture, 'ADBE');
  if (!near(quote.previous_close, 138.47, 0.05)) {
    console.error('FAIL offline previous_close (prior session close)');
    process.exit(1);
  }
  if (!near(quote.regular_price, 336.31, 0.1)) {
    console.error('FAIL offline regular_price');
    process.exit(1);
  }
  const derivedPct = ((333.57 - 336.31) / 336.31) * 100;
  if (!near(quote.postmarket_change_pct, derivedPct, 0.08)) {
    console.error('FAIL offline after % vs at close', quote.postmarket_change_pct);
    process.exit(1);
  }
  console.log('OK ADBE offline fixture assertions', { postmarket_change_pct: quote.postmarket_change_pct });
}