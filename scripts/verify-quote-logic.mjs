/**
 * Offline check: stale Yahoo REGULAR + currentPrice should yield extended price.
 * Run: node scripts/verify-quote-logic.mjs
 */
import { pickExtendedQuote } from '../src/lib/stockFormat.js';

const row = {
  symbol: 'MRVL',
  previous_close: 80.5,
  regular_price: 80.12,
  current_price: 79.85,
  premarket_price: null,
  postmarket_price: null,
  market_state: 'REGULAR',
};

const pre = pickExtendedQuote(row, 'pre');
const post = pickExtendedQuote(row, 'post');

if (pre != null) {
  console.error('FAIL pre must be null without PRE market_state', pre);
  process.exit(1);
}
if (post?.price !== 79.85) {
  console.error('FAIL post extended from current', post);
  process.exit(1);
}
const expectedPostPct = ((79.85 - 80.12) / 80.12) * 100;
if (post.pct == null || Math.abs(post.pct - expectedPostPct) > 0.02) {
  console.error('FAIL post pct vs regular close', { post, expectedPostPct });
  process.exit(1);
}
console.log('OK pickExtendedQuote stale REGULAR', { pre, post });