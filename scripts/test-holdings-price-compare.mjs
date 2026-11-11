/**
 * Offline holdings live vs custom delta checks.
 * Run: node scripts/test-holdings-price-compare.mjs
 */
import {
  mrvlHoldingsValuationPrice,
  mrvlLiveVsCustomDelta,
} from '../src/lib/holdingsPriceCompare.js';

const d = mrvlLiveVsCustomDelta(90, 80);
if (!d || d.deltaUsd !== 10 || Math.abs(d.deltaPct - 12.5) > 1e-6) {
  console.error('FAIL delta', d);
  process.exit(1);
}

if (mrvlLiveVsCustomDelta(null, 80) !== null) {
  console.error('FAIL null custom');
  process.exit(1);
}

if (mrvlHoldingsValuationPrice(90, 80) !== 90) {
  console.error('FAIL valuation custom wins');
  process.exit(1);
}
if (mrvlHoldingsValuationPrice(null, 80) !== 80) {
  console.error('FAIL valuation live fallback');
  process.exit(1);
}

console.log('OK holdings price compare');
