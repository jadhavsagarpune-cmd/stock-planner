/**
 * Offline MRVL chart live-merge checks.
 * Run: node scripts/test-chart-merge.mjs
 */
import { readFileSync } from 'node:fs';
import { mergeLivePriceIntoBars, pickLiveChartPrice } from '../src/lib/chartLiveMerge.js';
import {
  barIndexToSvgX,
  clientPointToSvg,
  nearestBarIndexFromPointer,
  pctFromRangeStart,
} from '../src/lib/mrvlChartGeometry.js';

/** Linear 1:1 viewport box → viewBox width (no letterboxing). */
function mockSvgLinear({ left = 100, width = 320, chartW = 640 }) {
  const scale = chartW / width;
  return {
    viewBox: { baseVal: { width: chartW, height: 160 } },
    getBoundingClientRect: () => ({ left, width, top: 0, height: 160 }),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform(matrix) {
        return matrix.matrixTransform(this);
      },
    }),
    getScreenCTM: () => ({
      inverse: () => ({
        matrixTransform(pt) {
          return { x: (pt.x - left) * scale, y: pt.y };
        },
      }),
    }),
  };
}

/** Wide container: 80px side gutters — naive rect.width mapping would skew hit-test. */
function mockSvgLetterbox({ contentOffsetX = 80, chartW = 640 }) {
  return {
    viewBox: { baseVal: { width: chartW, height: 160 } },
    getBoundingClientRect: () => ({ left: 0, width: 800, top: 0, height: 160 }),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform(matrix) {
        return matrix.matrixTransform(this);
      },
    }),
    getScreenCTM: () => ({
      inverse: () => ({
        matrixTransform(pt) {
          return { x: pt.x - contentOffsetX, y: pt.y };
        },
      }),
    }),
  };
}

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

const geom = { chartW: 640, padL: 8, plotW: 624, barCount: 5 };
const mockSvg = mockSvgLinear({ left: 100, width: 320, chartW: 640 });
const midIdx = nearestBarIndexFromPointer(260, mockSvg, geom);
if (midIdx !== 2) {
  console.error('FAIL nearestBarIndexFromPointer', midIdx);
  process.exit(1);
}

const letterbox = mockSvgLetterbox({ contentOffsetX: 80 });
const firstBarClientX = 80 + barIndexToSvgX(0, 5, 8, 624);
const letterIdx = nearestBarIndexFromPointer(firstBarClientX, letterbox, geom);
if (letterIdx !== 0) {
  console.error('FAIL letterbox nearestBarIndexFromPointer', letterIdx, firstBarClientX);
  process.exit(1);
}
const naiveSvgX = ((firstBarClientX - 0) / 800) * 640;
if (Math.abs(naiveSvgX - 8) < 5) {
  console.error('FAIL letterbox test setup — naive mapping should disagree with bar x=8', naiveSvgX);
  process.exit(1);
}
const mapped = clientPointToSvg(firstBarClientX, 0, letterbox, 640);
if (!mapped || Math.abs(mapped.x - 8) > 0.5) {
  console.error('FAIL clientPointToSvg letterbox', mapped);
  process.exit(1);
}

if (pctFromRangeStart(110, 100) !== 10) {
  console.error('FAIL pctFromRangeStart');
  process.exit(1);
}

console.log('OK chart live merge');
