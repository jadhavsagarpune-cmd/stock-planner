/**
 * Offline holdings live vs custom delta checks.
 * Run: node scripts/test-holdings-price-compare.mjs
 */
import {
  mrvlHoldingsValuationPrice,
  mrvlLiveVsCustomDelta,
} from '../src/lib/holdingsPriceCompare.js';

// Entry 80, live 90 → gain +10 (+12.5% vs entry)
const gain = mrvlLiveVsCustomDelta(80, 90);
if (!gain || gain.deltaUsd !== 10 || Math.abs(gain.deltaPct - 12.5) > 1e-6) {
  console.error('FAIL gain when live above entry', gain);
  process.exit(1);
}

// Entry 90, live 80 → loss −10
const loss = mrvlLiveVsCustomDelta(90, 80);
if (!loss || loss.deltaUsd !== -10) {
  console.error('FAIL loss when live below entry', loss);
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
