/**
 * Session headline price + day-change picker (pre vs regular mismatch).
 * Run: node scripts/test-session-quote.mjs
 */
import {
  marketStatusChip,
  pickActiveSessionPrice,
  pickLiveChartPrice,
  pickSessionDayChange,
  resolveActiveSession,
} from '../src/lib/sessionQuote.js';

/** Wed 7:00 ET — pre-market */
const PRE_MORNING = new Date('2026-11-11T12:00:00.000Z');

const preUpQuote = {
  symbol: 'MRVL',
  market_state: 'PRE',
  previous_close: 78,
  regular_price: 77,
  regular_change_pct: -1.28,
  regular_change_abs: -1,
  premarket_price: 80,
  premarket_change_pct: 2.56,
  premarket_change_abs: 2,
  current_price: 80,
};

if (resolveActiveSession(preUpQuote, PRE_MORNING) !== 'pre') {
  console.error('FAIL resolveActiveSession PRE');
  process.exit(1);
}
if (marketStatusChip(preUpQuote, PRE_MORNING) !== 'PRE') {
  console.error('FAIL marketStatusChip PRE');
  process.exit(1);
}
if (pickActiveSessionPrice(preUpQuote, PRE_MORNING) !== 80) {
  console.error('FAIL pickActiveSessionPrice uses premarket');
  process.exit(1);
}
if (pickLiveChartPrice(preUpQuote, PRE_MORNING) !== 80) {
  console.error('FAIL pickLiveChartPrice alias');
  process.exit(1);
}

const day = pickSessionDayChange(preUpQuote, PRE_MORNING);
if (!day || day.pct <= 0 || day.abs <= 0) {
  console.error('FAIL pickSessionDayChange must use pre gain not regular red', day);
  process.exit(1);
}
if (day.pct === preUpQuote.regular_change_pct) {
  console.error('FAIL pickSessionDayChange must not equal regular_change_pct in PRE');
  process.exit(1);
}

/** Regular session mid-day */
const REG_MIDDAY = new Date('2026-11-11T17:00:00.000Z');
const regQuote = {
  market_state: 'REGULAR',
  previous_close: 78,
  regular_price: 79.5,
  regular_change_pct: 1.92,
  regular_change_abs: 1.5,
  current_price: 79.6,
};

if (resolveActiveSession(regQuote, REG_MIDDAY) !== 'regular') {
  console.error('FAIL resolveActiveSession REG');
  process.exit(1);
}
if (marketStatusChip(regQuote, REG_MIDDAY) !== 'REG') {
  console.error('FAIL marketStatusChip REG');
  process.exit(1);
}
if (pickActiveSessionPrice(regQuote, REG_MIDDAY) !== 79.6) {
  console.error('FAIL pickActiveSessionPrice REG live');
  process.exit(1);
}
const regDay = pickSessionDayChange(regQuote, REG_MIDDAY);
if (regDay?.pct !== 1.92) {
  console.error('FAIL pickSessionDayChange REG', regDay);
  process.exit(1);
}

/** After hours */
const POST_EVENING = new Date('2026-11-11T22:00:00.000Z');
const postQuote = {
  market_state: 'POST',
  previous_close: 78,
  regular_price: 79,
  regular_change_pct: 1.28,
  postmarket_price: 80.5,
  postmarket_change_pct: 1.9,
  postmarket_change_abs: 1.5,
  current_price: 80.5,
};

if (pickActiveSessionPrice(postQuote, POST_EVENING) !== 80.5) {
  console.error('FAIL pickActiveSessionPrice POST');
  process.exit(1);
}
const postDay = pickSessionDayChange(postQuote, POST_EVENING);
if (!postDay || postDay.pct !== 1.9) {
  console.error('FAIL pickSessionDayChange POST', postDay);
  process.exit(1);
}

console.log('OK session quote pickers');
