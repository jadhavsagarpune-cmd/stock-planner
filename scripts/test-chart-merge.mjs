/**
 * Offline MRVL chart live-merge checks.
 * Run: node scripts/test-chart-merge.mjs
 */
import { mergeLivePriceIntoBars, pickLiveChartPrice } from '../src/lib/chartLiveMerge.js';

const yBars = [
  { t: Date.now() - 2 * 86_400_000, close: 78 },
  { t: Date.now() - 86_400_000, close: 79 },
];

const quote = {
  regular_price: 80.5,
  current_price: 80.75,
  market_state: 'REGULAR',
};

if (pickLiveChartPrice(quote) !== 80.75) {
  console.error('FAIL pickLiveChartPrice prefers current');
  process.exit(1);
}

const mergedDaily = mergeLivePriceIntoBars(yBars, quote, { interval: '1d' });
if (mergedDaily.length !== 3 || mergedDaily[2].close !== 80.75) {
  console.error('FAIL daily append today', mergedDaily);
  process.exit(1);
}

const intraBars = [
  { t: Date.now() - 5 * 60 * 1000, close: 79.9 },
];
const mergedIntra = mergeLivePriceIntoBars(intraBars, quote, { interval: '15m' });
if (mergedIntra.length !== 1 || mergedIntra[0].close !== 80.75) {
  console.error('FAIL intraday update bucket', mergedIntra);
  process.exit(1);
}

console.log('OK chart live merge');
