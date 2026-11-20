/**
 * Extended hours vs previous close (single baseline for pre and after).
 * Run: node scripts/test-premarket-baseline.mjs
 */
import { pickExtendedQuote } from '../src/lib/stockFormat.js';
import { pickSessionDayChange } from '../src/lib/sessionQuote.js';

/** Stale Yahoo: bad prior in meta already corrected on row; PM fields polluted from after-hours tick. */
const PRIOR = 138.47;
const REGULAR = 336.31;
const AFTER = 333.57;

const adbeLike = {
  symbol: 'ADBE',
  market_state: 'REGULAR',
  previous_close: PRIOR,
  regular_price: REGULAR,
  premarket_price: AFTER,
  premarket_change_pct: -7.32,
  premarket_change_abs: -10.66,
  postmarket_price: AFTER,
  postmarket_change_pct: -0.815,
  postmarket_change_abs: -2.74,
};

const pre = pickExtendedQuote(adbeLike, 'pre');
const expectedPrePct = ((AFTER - PRIOR) / PRIOR) * 100;
if (!pre || Math.abs(pre.pct - expectedPrePct) > 0.02) {
  console.error('FAIL pre vs prior close', { pre, expectedPrePct });
  process.exit(1);
}
if (pre.abs == null || Math.abs(pre.abs - (AFTER - PRIOR)) > 0.02) {
  console.error('FAIL pre abs vs prior close', pre);
  process.exit(1);
}

const post = pickExtendedQuote(adbeLike, 'post');
const expectedPostPct = ((AFTER - PRIOR) / PRIOR) * 100;
if (!post || Math.abs(post.pct - expectedPostPct) > 0.02) {
  console.error('FAIL post vs prior close', { post, expectedPostPct });
  process.exit(1);
}
if (post.abs == null || Math.abs(post.abs - (AFTER - PRIOR)) > 0.02) {
  console.error('FAIL post abs vs prior close', post);
  process.exit(1);
}

const POST_EVENING = new Date('2026-11-11T22:00:00.000Z');
const postQuote = {
  market_state: 'POST',
  previous_close: PRIOR,
  regular_price: REGULAR,
  postmarket_price: AFTER,
  current_price: AFTER,
};
const postDay = pickSessionDayChange(postQuote, POST_EVENING);
if (!postDay || Math.abs(postDay.pct - expectedPostPct) > 0.02) {
  console.error('FAIL pickSessionDayChange POST derive', postDay);
  process.exit(1);
}
if (postDay.referenceLabel !== 'After-hours vs prior close') {
  console.error('FAIL POST referenceLabel', postDay.referenceLabel);
  process.exit(1);
}

/** After hours: stale morning pre must not drive the POST column. */
const stalePrePost = {
  market_state: 'POST',
  previous_close: PRIOR,
  regular_price: REGULAR,
  premarket_price: 300,
  premarket_change_pct: -11.24,
  premarket_change_abs: -38.05,
  postmarket_price: AFTER,
  current_price: AFTER,
};
const stalePost = pickExtendedQuote(stalePrePost, 'post');
if (!stalePost || stalePost.price !== AFTER || Math.abs(stalePost.pct - expectedPostPct) > 0.02) {
  console.error('FAIL post must ignore stale premarket_price', { stalePost, expectedPostPct });
  process.exit(1);
}

/** Pre column empty when row has no live pre fields (cleared after open). */
const postOnlyRow = {
  market_state: 'REGULAR',
  previous_close: 100,
  regular_price: 95,
  postmarket_price: 94,
  current_price: 94,
};
const noPre = pickExtendedQuote(postOnlyRow, 'pre');
if (noPre != null && noPre.price != null) {
  console.error('FAIL pre quote without premarket fields', noPre);
  process.exit(1);
}

/** Outside pre session: no stale -10.71% from polluted Yahoo preMarketChangePercent. */
const stalePreOutsideSession = {
  market_state: 'POST',
  previous_close: PRIOR,
  regular_price: REGULAR,
  premarket_price: null,
  premarket_change_pct: null,
  premarket_change_abs: null,
  postmarket_price: AFTER,
};
const preWhenPost = pickExtendedQuote(stalePreOutsideSession, 'pre');
if (preWhenPost != null && preWhenPost.price != null) {
  console.error('FAIL pre must be empty outside PRE session', preWhenPost);
  process.exit(1);
}

console.log('OK extended-hours previous-close baseline');