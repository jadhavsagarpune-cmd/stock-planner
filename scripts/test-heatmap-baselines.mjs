/**
 * Offline baseline math checks.
 * Run: node scripts/test-heatmap-baselines.mjs
 */
import {
  pickHeatmapChangePctForBaseline,
  pickCurrentHeatmapPrice,
} from '../src/lib/heatmapBaselines.js';

// 5d with 4 bars indexes to oldest close (insufficient history → clamp to bar 0).

const row = {
  name: 'MRVL',
  status: 'done',
  regular_price: 100,
  previous_close: 90,
  current_price: 105,
  premarket_price: 102,
};

const prev = pickHeatmapChangePctForBaseline(row, 'previous_close', null);
if (prev == null || Math.abs(prev - (105 - 90) / 90 * 100) > 0.01) {
  console.error('FAIL previous_close', prev);
  process.exit(1);
}

const daily = {
  bars: [
    { t: 0, close: 80 },
    { t: 1, close: 85 },
    { t: 2, close: 90 },
    { t: 3, close: 95 },
  ],
};
const d5 = pickHeatmapChangePctForBaseline(row, '5d', { bars: daily.bars });
const expected5d = ((105 - 80) / 80) * 100;
if (d5 == null || Math.abs(d5 - expected5d) > 0.01) {
  console.error('FAIL 5d', { d5, expected5d });
  process.exit(1);
}

if (pickCurrentHeatmapPrice(row) !== 105) {
  console.error('FAIL current price');
  process.exit(1);
}

console.log('OK heatmap baselines');
