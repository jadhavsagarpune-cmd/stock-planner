/**
 * Offline check: stale Yahoo REGULAR + currentPrice should yield extended price.
 * Run: node scripts/verify-quote-logic.mjs
 */
import { pickExtendedQuote } from '../src/lib/stockFormat.js';

const row = {
  symbol: 'MRVL',
  regular_price: 80.12,
  current_price: 79.85,
  premarket_price: null,
  postmarket_price: null,
  market_state: 'REGULAR',
};

const pre = pickExtendedQuote(row, 'pre');
const post = pickExtendedQuote(row, 'post');

if (pre?.price !== 79.85 || post?.price !== 79.85) {
  console.error('FAIL', { pre, post });
  process.exit(1);
}
console.log('OK pickExtendedQuote stale REGULAR', { pre, post });
