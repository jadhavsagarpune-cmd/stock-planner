import {
  parseStooqCsv,
  stooqMetaFromSymbol,
  yahooSymbolToStooq,
} from '../api/_stooqFallback.js';

function assert(cond, msg = 'assert failed') {
  if (!cond) throw new Error(msg);
}

const sample = `Symbol,Date,Time,Open,High,Low,Close,Volume
MRVL.US,2026-11-25,22:05:03,131.5,132.1,130.2,130.93,1000
MRVL.US,2026-11-24,22:05:03,128,129.5,127,128.5,900`;

assert(yahooSymbolToStooq('MRVL') === 'mrvl.us');
assert(yahooSymbolToStooq('INR=X') === 'usd/inr');
assert(yahooSymbolToStooq('005930.KS') === '005930.kr');

const parsed = parseStooqCsv(sample);
assert(parsed?.close === 130.93);
assert(parsed?.prevClose === 128.5);

const meta = stooqMetaFromSymbol('MRVL', parsed);
assert(meta.regularMarketPrice === 130.93);
assert(meta.regularMarketPreviousClose === 128.5);
assert(Math.abs(meta.regularMarketChange - (130.93 - 128.5)) < 0.01);

console.log('OK stooq fallback parse');