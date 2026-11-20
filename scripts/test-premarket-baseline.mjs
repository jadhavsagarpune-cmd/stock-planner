/**
 * Pre-market vs prior close (Yahoo-style); after-hours vs regular close.
 * Run: node scripts/test-premarket-baseline.mjs
 */
import { pickExtendedQuote } from '../src/lib/stockFormat.js';
import { pickSessionDayChange } from '../src/lib/sessionQuote.js';

/** Stale Yahoo: bad prior in meta already corrected on row; PM fields polluted from after-hours tick. */
const adbeLike = {
  symbol: 'ADBE',
  market_state: 'REGULAR',
  previous_close: 338.05,
  regular_price: 336.31,
  premarket_price: 333.57,
  premarket_change_pct: -7.32,
  premarket_change_abs: -10.66,
  postmarket_price: 333.57,
  postmarket_change_pct: -0.815,
  postmarket_change_abs: -2.74,
};

const pre = pickExtendedQuote(adbeLike, 'pre');
const expectedPrePct = ((333.57 - 338.05) / 338.05) * 100;
if (!pre || Math.abs(pre.pct - expectedPrePct) > 0.02) {
  console.error('FAIL pre vs prior close', { pre, expectedPrePct });
  process.exit(1);
}
if (pre.abs == null || Math.abs(pre.abs - (333.57 - 338.05)) > 0.02) {
  console.error('FAIL pre abs vs prior close', pre);
  process.exit(1);
}

const post = pickExtendedQuote(adbeLike, 'post');
const expectedPostPct = ((333.57 - 336.31) / 336.31) * 100;
if (!post || Math.abs(post.pct - expectedPostPct) > 0.02) {
  console.error('FAIL post vs regular close', { post, expectedPostPct });
  process.exit(1);
}
if (post.abs == null || Math.abs(post.abs + 2.74) > 0.02) {
  console.error('FAIL post abs', post);
  process.exit(1);
}

const POST_EVENING = new Date('2026-11-11T22:00:00.000Z');
const postQuote = {
  market_state: 'POST',
  previous_close: 338.05,
  regular_price: 336.31,
  postmarket_price: 333.57,
  current_price: 333.57,
};
const postDay = pickSessionDayChange(postQuote, POST_EVENING);
if (!postDay || Math.abs(postDay.pct - expectedPostPct) > 0.02) {
  console.error('FAIL pickSessionDayChange POST derive', postDay);
  process.exit(1);
}

console.log('OK premarket baseline');