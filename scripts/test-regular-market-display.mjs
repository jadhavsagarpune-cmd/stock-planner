/**
 * Regular Market column: live during US REGULAR; session close off-hours.
 * Run: node scripts/test-regular-market-display.mjs
 */
import { pickRegularMarketDisplay } from '../src/lib/stockFormat.js';

const REG_MIDDAY = new Date('2026-11-11T17:00:00.000Z');
const POST_EVENING = new Date('2026-11-11T22:00:00.000Z');
const PRE_MORNING = new Date('2026-11-20T09:29:00.000Z');

const liveRow = {
  name: 'MRVL',
  market_state: 'REGULAR',
  previous_close: 78,
  regular_price: 79.5,
  regular_change_pct: 1.92,
  current_price: 79.85,
};

const live = pickRegularMarketDisplay(liveRow, REG_MIDDAY);
if (!live?.live || live.price !== 79.85) {
  console.error('FAIL live regular session uses current_price', live);
  process.exit(1);
}
const expectedPct = ((79.85 - 78) / 78) * 100;
if (Math.abs(live.pct - expectedPct) > 0.02) {
  console.error('FAIL live pct vs previous close', live);
  process.exit(1);
}

const closeRow = {
  name: 'ADBE',
  market_state: 'POST',
  previous_close: 138.47,
  regular_price: 336.31,
  regular_change_pct: 142.87,
  current_price: 333.57,
};

const closed = pickRegularMarketDisplay(closeRow, POST_EVENING);
if (closed?.live || closed?.price !== 336.31) {
  console.error('FAIL after hours uses regular session close not current', closed);
  process.exit(1);
}
if (Math.abs(closed.pct - 142.87) > 0.05) {
  console.error('FAIL session close day pct', closed);
  process.exit(1);
}

const mrvlPreRow = {
  name: 'MRVL',
  market_state: 'PRE',
  previous_close: 138.47,
  regular_price: 138.47,
  regular_change_pct: 0,
  premarket_price: 132.63,
};

const mrvlPre = pickRegularMarketDisplay(mrvlPreRow, PRE_MORNING);
if (!mrvlPre?.preIdle || mrvlPre.price != null) {
  console.error('FAIL pre session must not show regular price duped from previous close', mrvlPre);
  process.exit(1);
}

const gapPreRow = {
  name: 'ADBE',
  market_state: 'PRE',
  previous_close: 138.47,
  regular_price: 336.31,
  regular_change_pct: 142.87,
};

const gapPre = pickRegularMarketDisplay(gapPreRow, PRE_MORNING);
if (!gapPre?.preIdle || gapPre.price != null) {
  console.error('FAIL pre session never shows Regular Market column data', gapPre);
  process.exit(1);
}

console.log('OK pickRegularMarketDisplay');