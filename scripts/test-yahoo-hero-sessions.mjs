/**
 * Yahoo hero dual-block layout (at close + after hours).
 * Run: node scripts/test-yahoo-hero-sessions.mjs
 */
import { mapYahooMetaToQuote } from '../src/lib/quotes.js';
import { resolveYahooQuotePanels } from '../src/lib/yahooHeroSessions.js';
import { formatAtCloseLabel, formatAfterHoursLabel } from '../src/lib/marketTimeFormat.js';

const thanksgivingEvening = new Date('2026-11-26T20:00:00-05:00');

const MRVL_META = {
  symbol: 'MRVL',
  marketState: 'CLOSED',
  regularMarketPrice: 130.93,
  regularMarketPreviousClose: 131.57,
  previousClose: 131.57,
  regularMarketChange: -0.64,
  regularMarketChangePercent: -0.487,
  postMarketPrice: 133.61,
  postMarketChange: 2.68,
  postMarketChangePercent: 2.046,
  regularMarketTime: 1795640402,
  postMarketTime: 1795654776,
  regularMarketDayHigh: 132.4,
  regularMarketDayLow: 129.8,
  fiftyTwoWeekHigh: 141,
  fiftyTwoWeekLow: 47.21,
};

const quote = mapYahooMetaToQuote(MRVL_META, 'MRVL', null, { now: thanksgivingEvening });
const panels = resolveYahooQuotePanels(quote, thanksgivingEvening, 'live', null);

if (panels.kind !== 'dual') {
  console.error('FAIL thanksgiving hero must be dual block', panels);
  process.exit(1);
}
if (Math.abs(panels.atClose.price - 130.93) > 0.01) {
  console.error('FAIL at close price', panels.atClose.price);
  process.exit(1);
}
if (Math.abs(panels.extended.price - 133.61) > 0.01) {
  console.error('FAIL after hours price', panels.extended.price);
  process.exit(1);
}
const expectedAfterPct = ((133.61 - 130.93) / 130.93) * 100;
if (Math.abs(panels.extended.pct - expectedAfterPct) > 0.08) {
  console.error('FAIL after % vs at close', panels.extended.pct, expectedAfterPct);
  process.exit(1);
}
if (!String(panels.atClose.timeLabel).startsWith('At close:')) {
  console.error('FAIL at close label', panels.atClose.timeLabel);
  process.exit(1);
}
if (!String(panels.extended.timeLabel).startsWith('After hours:')) {
  console.error('FAIL after hours label', panels.extended.timeLabel);
  process.exit(1);
}

const ts = formatAtCloseLabel(MRVL_META.regularMarketTime);
const tsPost = formatAfterHoursLabel(MRVL_META.postMarketTime);
if (!ts?.includes('PM') || !tsPost?.includes('PM')) {
  console.error('FAIL timestamp formatting', { ts, tsPost });
  process.exit(1);
}

console.log('OK yahoo hero sessions', {
  atClose: panels.atClose.price,
  after: panels.extended.price,
  atCloseLabel: panels.atClose.timeLabel,
  afterLabel: panels.extended.timeLabel,
});