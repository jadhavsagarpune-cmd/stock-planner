/**
 * Yahoo chart meta → app quote columns (ADBE big-move regression).
 * Run: node scripts/test-yahoo-quote-mapping.mjs
 */
import {
  mapYahooMetaToQuote,
  resolvePreviousClose,
  resolveRegularMarketPrice,
} from '../src/lib/quotes.js';
import { quoteIsRenderable, sanitizeQuotePrices } from '../src/lib/quoteResilience.js';
import { mergeYahooExtendedFields } from '../src/lib/yahooExtendedMerge.js';

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
  console.error('FAIL mapped previous_close (prior session close, as on Yahoo)', quote.previous_close);
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
  console.error('FAIL post change vs at close', {
    got: quote.postmarket_change_pct,
    expected: expectedAfterPct,
  });
  process.exit(1);
}
if (Math.abs(quote.postmarket_change_abs - (333.57 - 336.31)) > 0.05) {
  console.error('FAIL post abs vs at close', quote.postmarket_change_abs);
  process.exit(1);
}

/** MRVL pre-market: v7 prior 138.47; chart previousClose 145.54 must not drive baseline. */
const MRVL_META_PRE = {
  symbol: 'MRVL',
  marketState: 'PRE',
  regularMarketPrice: 138.47,
  regularMarketPreviousClose: 138.47,
  previousClose: 145.54,
  chartPreviousClose: 145.54,
  regularMarketChange: -5.84,
  preMarketPrice: 132.63,
  preMarketChange: -5.84,
  preMarketChangePercent: -4.22,
};

const mrvlPrev = resolvePreviousClose(MRVL_META_PRE, 138.47);
if (mrvlPrev == null || Math.abs(mrvlPrev - 138.47) > 0.02) {
  console.error('FAIL MRVL previous_close must be v7 regularMarketPreviousClose', { mrvlPrev });
  process.exit(1);
}

/** Live-shaped bug: chart previousClose 145.54 but regularMarketPrice 138.47 during PRE. */
const MRVL_LIVE_SHAPED = {
  symbol: 'MRVL',
  marketState: 'REGULAR',
  regularMarketPrice: 138.47,
  regularMarketPreviousClose: undefined,
  previousClose: 145.54,
  chartPreviousClose: 145.54,
  preMarketPrice: 132.3,
  preMarketChange: -13.24,
  currentPrice: 132.3,
};
const preMorningEt = new Date('2026-11-25T08:00:00-05:00');
const livePrev = resolvePreviousClose(MRVL_LIVE_SHAPED, 138.47, preMorningEt);
if (livePrev == null || Math.abs(livePrev - 138.47) > 0.02) {
  console.error('FAIL MRVL live-shaped prior must be regularMarketPrice 138.47', { livePrev });
  process.exit(1);
}
const MRVL_V7_MERGED = {
  ...MRVL_LIVE_SHAPED,
  regularMarketPreviousClose: 138.47,
};
const v7Prev = resolvePreviousClose(MRVL_V7_MERGED, 138.47);
if (Math.abs(v7Prev - 138.47) > 0.02) {
  console.error('FAIL v7 regularMarketPreviousClose must pin prior', v7Prev);
  process.exit(1);
}
const liveQuote = mapYahooMetaToQuote(MRVL_V7_MERGED, 'MRVL', undefined, { now: preMorningEt });
const livePrePct = ((132.3 - 138.47) / 138.47) * 100;
if (Math.abs(liveQuote.premarket_change_pct - livePrePct) > 0.15) {
  console.error('FAIL MRVL pre % vs 138.47', liveQuote.premarket_change_pct, livePrePct);
  process.exit(1);
}

const mrvlQuote = mapYahooMetaToQuote(MRVL_META_PRE, 'MRVL');
const expectedMrvlPrePct = ((132.63 - 138.47) / 138.47) * 100;
if (Math.abs(mrvlQuote.premarket_change_pct - expectedMrvlPrePct) > 0.05) {
  console.error('FAIL MRVL premarket_change_pct vs prior', {
    got: mrvlQuote.premarket_change_pct,
    expected: expectedMrvlPrePct,
  });
  process.exit(1);
}
if (Math.abs(mrvlQuote.premarket_change_abs - (132.63 - 138.47)) > 0.02) {
  console.error('FAIL MRVL premarket_change_abs', mrvlQuote.premarket_change_abs);
  process.exit(1);
}

/** Gap-down day: pre % vs last at close (122.28), not prior session close 138.47. */
const MRVL_GAP_PRE = {
  symbol: 'MRVL',
  marketState: 'PRE',
  regularMarketPrice: 122.28,
  regularMarketPreviousClose: 138.47,
  regularMarketChange: -16.19,
  regularMarketChangePercent: -11.69,
  preMarketPrice: 130,
};
const gapQuote = mapYahooMetaToQuote(MRVL_GAP_PRE, 'MRVL');
const expectedGapPre = ((130 - 122.28) / 122.28) * 100;
if (Math.abs(gapQuote.premarket_change_pct - expectedGapPre) > 0.05) {
  console.error('FAIL MRVL gap pre % vs at close', {
    got: gapQuote.premarket_change_pct,
    expected: expectedGapPre,
  });
  process.exit(1);
}
if (Math.abs(gapQuote.regular_change_pct - -11.69) > 0.05) {
  console.error('FAIL MRVL gap regular day %', gapQuote.regular_change_pct);
  process.exit(1);
}
if (Math.abs(gapQuote.previous_close - 138.47) > 0.05) {
  console.error('FAIL MRVL gap display previous_close', gapQuote.previous_close);
  process.exit(1);
}

const zeroQuote = sanitizeQuotePrices({
  symbol: 'MRVL',
  previous_close: 0,
  regular_price: 0,
  postmarket_price: 0,
  regular_change_pct: -1.2,
});
if (!quoteIsRenderable(zeroQuote)) {
  console.log('OK zero Yahoo prices sanitized (no $0.00 hero)');
} else {
  console.error('FAIL zero prices must not be renderable', zeroQuote);
  process.exit(1);
}

const v7OnlyMeta = {
  symbol: 'MRVL',
  marketState: 'POST',
  regularMarketPrice: 92.12,
  regularMarketPreviousClose: 91.44,
  postMarketPrice: 92.5,
  postMarketChangePercent: 0.41,
};
const v7Only = mapYahooMetaToQuote(v7OnlyMeta, 'MRVL');
if (!quoteIsRenderable(v7Only) || v7Only.regular_price !== 92.12) {
  console.error('FAIL v7-only partial quote', v7Only);
  process.exit(1);
}

const stooqOnly = {
  source: 'stooq_fallback',
  symbol: 'MRVL',
  marketState: 'CLOSED',
  regularMarketPrice: 130.93,
  regularMarketPreviousClose: 131.57,
};
const yahooExt = {
  postMarketPrice: 133.61,
  postMarketChange: 2.68,
  postMarketChangePercent: 2.05,
  postMarketTime: 1764110376,
  marketState: 'CLOSED',
};
const merged = mergeYahooExtendedFields(stooqOnly, yahooExt);
const mergedQuote = mapYahooMetaToQuote(merged, 'MRVL');
if (mergedQuote.postmarket_price == null || Math.abs(mergedQuote.postmarket_price - 133.61) > 0.02) {
  console.error('FAIL stooq+yahoo extended merge', mergedQuote.postmarket_price);
  process.exit(1);
}
const mergedAfterPct = ((133.61 - 130.93) / 130.93) * 100;
if (Math.abs(mergedQuote.postmarket_change_pct - mergedAfterPct) > 0.08) {
  console.error('FAIL merged after % vs at close', mergedQuote.postmarket_change_pct);
  process.exit(1);
}

const thanksgivingMeta = {
  symbol: 'MRVL',
  marketState: 'CLOSED',
  regularMarketPrice: 130.93,
  regularMarketPreviousClose: 131.57,
  regularMarketChange: -0.64,
  regularMarketChangePercent: -0.49,
  postMarketPrice: 133.61,
  postMarketChange: 2.68,
  postMarketChangePercent: 2.05,
};
const thQuote = mapYahooMetaToQuote(thanksgivingMeta, 'MRVL');
if (Math.abs(thQuote.regular_price - 130.93) > 0.01 || Math.abs(thQuote.postmarket_price - 133.61) > 0.01) {
  console.error('FAIL thanksgiving MRVL fixture', thQuote);
  process.exit(1);
}

console.log('OK yahoo quote mapping', {
  previous_close: quote.previous_close,
  regular_price: quote.regular_price,
  postmarket_change_pct: quote.postmarket_change_pct,
  mrvl_premarket_change_pct: mrvlQuote.premarket_change_pct,
});