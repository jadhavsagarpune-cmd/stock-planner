/**
 * Live ADBE quote + raw Yahoo meta (requires network).
 * Run: node scripts/fetch-adbe-quote.mjs
 */
import { fetchYahooQuote } from '../src/lib/quotes.js';

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/ADBE';
const qs = 'interval=1m&range=1d&includePrePost=true';
const headers = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

try {
  const resp = await fetch(`${YAHOO}?${qs}`, { headers });
  if (!resp.ok) throw new Error(`Yahoo HTTP ${resp.status}`);
  const payload = await resp.json();
  const meta = payload?.chart?.result?.[0]?.meta ?? {};
  const pick = (k) => meta[k];
  console.log('RAW_YAHOO_META', JSON.stringify({
    regularMarketPrice: pick('regularMarketPrice'),
    regularMarketPreviousClose: pick('regularMarketPreviousClose'),
    previousClose: pick('previousClose'),
    chartPreviousClose: pick('chartPreviousClose'),
    regularMarketChange: pick('regularMarketChange'),
    regularMarketChangePercent: pick('regularMarketChangePercent'),
    currentPrice: pick('currentPrice'),
    postMarketPrice: pick('postMarketPrice'),
    marketState: pick('marketState'),
  }, null, 2));

  const quote = await fetchYahooQuote('ADBE');
  console.log('MAPPED_QUOTE', JSON.stringify(quote, null, 2));
} catch (err) {
  console.error('fetch-adbe-quote failed:', err.message);
  process.exit(1);
}