/** Chart v8 → quote row (after-hours from last extended bar) + baseline storage migration. */
import assert from 'node:assert/strict';
import { chartResultToQuoteRow } from '../api/_chartQuote.js';

const period = {
  pre: { start: 1000, end: 2000 },
  regular: { start: 2000, end: 3000 },
  post: { start: 3000, end: 4000 },
};
const result = {
  meta: {
    symbol: 'TEST',
    regularMarketPrice: 100,
    chartPreviousClose: 98,
    regularMarketTime: 2999,
    currentTradingPeriod: period,
  },
  timestamp: [1500, 2500, 2999, 3100, 3500, 3900],
  indicators: { quote: [{ close: [97, 99, 100, 101, null, 102] }] },
};

// After hours (now past post end → CLOSED): last post bar wins, change vs at close.
let row = chartResultToQuoteRow(result, 'TEST', { nowSec: 5000 });
assert.equal(row.marketState, 'CLOSED');
assert.equal(row.regularMarketPreviousClose, 98);
assert.equal(row.postMarketPrice, 102);
assert.equal(row.postMarketTime, 3900);
assert.ok(Math.abs(row.postMarketChange - 2) < 1e-9);
assert.equal(row.preMarketPrice, undefined);

// Pre-market (now inside pre window): last pre bar, no post price.
row = chartResultToQuoteRow(result, 'TEST', { nowSec: 1800 });
assert.equal(row.marketState, 'PRE');
assert.equal(row.preMarketPrice, 97);
assert.equal(row.postMarketPrice, undefined);

// Regular session: neither extended price.
row = chartResultToQuoteRow(result, 'TEST', { nowSec: 2500 });
assert.equal(row.marketState, 'REGULAR');
assert.equal(row.postMarketPrice, undefined);

// Never non-positive prices.
assert.equal(
  chartResultToQuoteRow({ meta: { symbol: 'X', regularMarketPrice: 0 }, timestamp: [], indicators: {} }, 'X'),
  null,
);

// Baseline storage migration.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { loadHeatmapBaselineId, saveHeatmapBaselineId, HEATMAP_BASELINE_STORAGE_KEY, HEATMAP_BASELINE_USER_PICKED_KEY } =
  await import('../src/lib/heatmapBaselines.js');
const thanksgiving = new Date('2026-11-26T15:00:00Z');
store.set(HEATMAP_BASELINE_STORAGE_KEY, 'live');
store.set(HEATMAP_BASELINE_USER_PICKED_KEY, '1'); // legacy flag
assert.equal(loadHeatmapBaselineId(thanksgiving), 'previous_close');
assert.equal(store.has(HEATMAP_BASELINE_STORAGE_KEY), false);
store.set(HEATMAP_BASELINE_STORAGE_KEY, 'bogus');
assert.equal(loadHeatmapBaselineId(thanksgiving), 'previous_close');
saveHeatmapBaselineId('ytd');
assert.equal(loadHeatmapBaselineId(), 'ytd');
console.log('OK chart quote + baseline storage');
