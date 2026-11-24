/**
 * Offline baseline math checks.
 * Run: node scripts/test-heatmap-baselines.mjs
 */
import {
  HEATMAP_BASELINES,
  heatmapBaselinePickerGroups,
  pickHeatmapChangePctForBaseline,
  pickCurrentHeatmapPrice,
} from '../src/lib/heatmapBaselines.js';

const { session, history } = heatmapBaselinePickerGroups();
const sessionBadges = session.map((b) => b.badge).join(',');
if (sessionBadges !== 'LIVE,PRE,POST') {
  console.error('FAIL session chip order', sessionBadges);
  process.exit(1);
}
if (session[0]?.id !== 'live') {
  console.error('FAIL LIVE must be first session chip', session[0]);
  process.exit(1);
}
const expectedPickerBadges = HEATMAP_BASELINES.map((b) => b.badge).join(',');
const actualPickerBadges = [...session, ...history].map((b) => b.badge).join(',');
if (expectedPickerBadges !== actualPickerBadges) {
  console.error('FAIL picker groups drift', { expectedPickerBadges, actualPickerBadges });
  process.exit(1);
}

// 5d with 4 bars indexes to oldest close (insufficient history → clamp to bar 0).

const row = {
  name: 'MRVL',
  status: 'done',
  regular_price: 100,
  previous_close: 90,
  current_price: 105,
  premarket_price: 102,
  regular_change_pct: 11.11,
  market_state: 'REGULAR',
};

const sessionLive = pickHeatmapChangePctForBaseline(row, 'live', null);
if (sessionLive == null || Math.abs(sessionLive - 11.11) > 0.01) {
  console.error('FAIL live baseline during REGULAR', sessionLive);
  process.exit(1);
}

const rowPre = {
  ...row,
  market_state: 'PRE',
  premarket_price: 102,
  regular_price: 100,
  regular_change_pct: 0,
};
const sessionPre = pickHeatmapChangePctForBaseline(rowPre, 'pre', null);
if (sessionPre == null || Math.abs(sessionPre - 2) > 0.01) {
  console.error('FAIL pre baseline', sessionPre);
  process.exit(1);
}

const rowPost = {
  ...row,
  market_state: 'POST',
  postmarket_price: 103,
  regular_price: 100,
  previous_close: 90,
};
const sessionPost = pickHeatmapChangePctForBaseline(rowPost, 'post', null);
const expectedPost = ((103 - 100) / 100) * 100;
if (sessionPost == null || Math.abs(sessionPost - expectedPost) > 0.01) {
  console.error('FAIL post baseline', { sessionPost, expectedPost });
  process.exit(1);
}

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

const pctOnly = {
  name: 'NVDA',
  status: 'done',
  regular_change_pct: 1.5,
  market_state: 'REGULAR',
};
const prevFromPct = pickHeatmapChangePctForBaseline(pctOnly, 'previous_close', null);
if (prevFromPct == null || Math.abs(prevFromPct - 1.5) > 0.01) {
  console.error('FAIL PREV falls back to regular_change_pct', prevFromPct);
  process.exit(1);
}

console.log('OK heatmap baselines');
