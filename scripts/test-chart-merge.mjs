/**
 * Offline MRVL chart live-merge checks.
 * Run: node scripts/test-chart-merge.mjs
 */
import { readFileSync } from 'node:fs';
import { mergeLivePriceIntoBars, pickLiveChartPrice } from '../src/lib/chartLiveMerge.js';
import {
  barIndexToSvgX,
  nearestBarIndexFromPointer,
  pctFromRangeStart,
} from '../src/lib/mrvlChartGeometry.js';

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

const merged1d = mergeLivePriceIntoBars(
  [{ t: Date.now() - 3 * 60 * 1000, close: 79.95 }],
  quote,
  { interval: '5m' },
);
if (merged1d.length !== 1 || merged1d[0].close !== 80.75) {
  console.error('FAIL 1D 5m update bucket', merged1d);
  process.exit(1);
}

const histSrc = readFileSync(
  new URL('../src/lib/historicalQuotes.js', import.meta.url),
  'utf8',
);
if (
  !/^\s*\{ id: '1D', label: '1D', range: '1d', interval: '[15]m' \},/m.test(histSrc)
  || !histSrc.includes("export const DEFAULT_MRVL_CHART_RANGE_ID = '1D';")
) {
  console.error('FAIL 1D range chip / default in historicalQuotes.js');
  process.exit(1);
}

if (barIndexToSvgX(0, 3, 8, 100) !== 8) {
  console.error('FAIL barIndexToSvgX first');
  process.exit(1);
}
if (barIndexToSvgX(2, 3, 8, 100) !== 108) {
  console.error('FAIL barIndexToSvgX last');
  process.exit(1);
}

const mockSvg = {
  getBoundingClientRect: () => ({ left: 100, width: 320 }),
};
const midIdx = nearestBarIndexFromPointer(260, mockSvg, {
  chartW: 640,
  padL: 8,
  plotW: 624,
  barCount: 5,
});
if (midIdx !== 2) {
  console.error('FAIL nearestBarIndexFromPointer', midIdx);
  process.exit(1);
}

if (pctFromRangeStart(110, 100) !== 10) {
  console.error('FAIL pctFromRangeStart');
  process.exit(1);
}

console.log('OK chart live merge');
