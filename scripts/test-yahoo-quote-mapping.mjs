/**
 * Yahoo chart meta → app quote columns (ADBE big-move regression).
 * Run: node scripts/test-yahoo-quote-mapping.mjs
 */
import {
  mapYahooMetaToQuote,
  resolvePreviousClose,
  resolveRegularMarketPrice,
} from '../src/lib/quotes.js';

const ADBE_META_STALE_CHART = {
  symbol: 'ADBE',
  marketState: 'POST',
  regularMarketPrice: 138.47,
  regularMarketPreviousClose: 138.47,
  previousClose: 145.12,
  chartPreviousClose: 338.05,
  regularMarketChange: 197.84,
  regularMarketChangePercent: 142.87,
  currentPrice: 333.57,
  postMarketPrice: 333.57,
  postMarketChange: -2.74,
  postMarketChangePercent: -0.815,
};

const prev = resolvePreviousClose(ADBE_META_STALE_CHART, 336.31);
if (prev == null || Math.abs(prev - 138.47) > 0.05) {
  console.error('FAIL previous_close', { prev, expected: 138.47 });
  process.exit(1);
}

const regular = resolveRegularMarketPrice(ADBE_META_STALE_CHART, prev);
if (regular == null || Math.abs(regular - 336.31) > 0.1) {
  console.error('FAIL regular_price unstuck from prior', { regular, expected: 336.31 });
  process.exit(1);
}

const alignedMeta = {
  ...ADBE_META_STALE_CHART,
  regularMarketPrice: 336.31,
  previousClose: 138.47,
};
const prev2 = resolvePreviousClose(alignedMeta, 336.31);
if (Math.abs(prev2 - 138.47) > 0.05) {
  console.error('FAIL prior when Yahoo aligned', prev2);
  process.exit(1);
}

const quote = mapYahooMetaToQuote(alignedMeta, 'ADBE');
if (Math.abs(quote.previous_close - 138.47) > 0.05) {
  console.error('FAIL mapped previous_close', quote.previous_close);
  process.exit(1);
}
if (Math.abs(quote.regular_price - 336.31) > 0.1) {
  console.error('FAIL mapped regular_price', quote.regular_price);
  process.exit(1);
}
if (Math.abs(quote.postmarket_price - 333.57) > 0.05) {
  console.error('FAIL mapped postmarket_price', quote.postmarket_price);
  process.exit(1);
}
const expectedAfterPct = ((333.57 - 336.31) / 336.31) * 100;
if (Math.abs(quote.postmarket_change_pct - expectedAfterPct) > 0.05) {
  console.error('FAIL post change vs regular', {
    got: quote.postmarket_change_pct,
    expected: expectedAfterPct,
  });
  process.exit(1);
}
if (Math.abs(quote.postmarket_change_abs - (333.57 - 336.31)) > 0.05) {
  console.error('FAIL post abs vs regular', quote.postmarket_change_abs);
  process.exit(1);
}

console.log('OK yahoo quote mapping', {
  previous_close: quote.previous_close,
  regular_price: quote.regular_price,
  postmarket_change_pct: quote.postmarket_change_pct,
});