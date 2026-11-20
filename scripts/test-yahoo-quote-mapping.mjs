/**
 * Yahoo chart meta → app quote columns (ADBE big-move regression).
 * Run: node scripts/test-yahoo-quote-mapping.mjs
 */
import {
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

console.log('OK yahoo quote mapping', { previous_close: prev2, regular_price: 336.31 });