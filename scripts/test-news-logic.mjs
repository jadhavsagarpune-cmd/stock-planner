import {
  applyTimeWindow, buildNews, categorize, dedupeItems, parseGoogleRss, parseYahooNews, similarTitles,
} from '../api/_newsLogic.js';
import { buildMoveMap, rankNews, scoreItem, keywordBoost } from '../src/lib/newsRank.js';

function assert(c, m = 'assert failed') { if (!c) throw new Error(m); }
const now = Date.parse('2026-11-26T15:00:00Z');
const h = (n) => now - n * 3_600_000;
const mk = (title, hrs, tickers, url = `https://x/${title}`) => ({ title, publisher: 'P', url, publishedAt: h(hrs), tickers });

// dedupe
assert(similarTitles('Marvell stock jumps on AI demand - Reuters', 'Marvell stock jumps on AI demand - CNBC'));
assert(!similarTitles('Marvell jumps on AI demand', 'Nvidia faces export probe in China'));
const d = dedupeItems([mk('Marvell stock jumps on AI demand - Reuters', 1, ['MRVL']), mk('Marvell stock jumps on AI demand - CNBC', 2, ['NVDA'])]);
assert(d.length === 1 && d[0].tickers.length === 2, 'dedupe merge');

// window + fallback
const a = applyTimeWindow([mk('a', 2, ['X']), mk('b', 30, ['X'])], now);
assert(a.windowHours === 24 && a.items.length === 1, '24h window');
const b = applyTimeWindow([mk('b', 30, ['X']), mk('c', 60, ['X']), mk('old', 100, ['X'])], now);
assert(b.windowHours === 72 && b.items.length === 2, '72h fallback');
assert(applyTimeWindow([mk('old', 100, ['X'])], now).items.length === 0, 'empty beyond 72h');

// categories
assert(categorize(mk('x', 1, ['MRVL'])) === 'marvell');
assert(categorize(mk('x', 1, ['NVDA'])) === 'semis');
assert(categorize(mk('x', 1, ['AAPL'])) === 'market');
const nb = buildNews([mk('Marvell news', 1, ['MRVL']), mk('Fed holds', 2, ['SPY'])], now);
assert(nb.items.length === 2 && typeof nb.items[0].publishedAt === 'string');

// parsers
const y = parseYahooNews({ news: [{ title: 'T', link: 'https://a/b', publisher: 'Y', providerPublishTime: 1700000000, relatedTickers: ['AMD'] }, { title: '' }] }, 'MRVL');
assert(y.length === 1 && y[0].tickers.includes('AMD') && y[0].publishedAt === 1700000000000);
const rss = '<rss><item><title>Marvell wins deal - Reuters</title><link>https://g/1</link><pubDate>Wed, 25 Nov 2026 10:00:00 GMT</pubDate><source url="x">Reuters</source></item></rss>';
const g = parseGoogleRss(rss, 'MRVL');
assert(g.length === 1 && g[0].title === 'Marvell wins deal' && g[0].publisher === 'Reuters');

// scoring + ranking
const moves = buildMoveMap([{ name: 'NVDA', status: 'done', regular_change_pct: -2.7 }, { name: 'AMD', status: 'done', regular_change_pct: 0.5 }], null);
assert(keywordBoost('Nvidia export probe') === 4);
assert(Math.abs(scoreItem({ title: 'plain', tickers: ['NVDA'] }, moves) - 2.7) < 1e-9);
const ranked = rankNews([
  { title: 'amd plain', tickers: ['AMD'], category: 'semis', publishedAt: new Date(h(1)).toISOString() },
  { title: 'nvda tariff', tickers: ['NVDA'], category: 'semis', publishedAt: new Date(h(5)).toISOString() },
  { title: 'mrvl old', tickers: ['MRVL'], category: 'marvell', publishedAt: new Date(h(9)).toISOString() },
  { title: 'mrvl new', tickers: ['MRVL'], category: 'marvell', publishedAt: new Date(h(2)).toISOString() },
], moves);
assert(ranked.map((r) => r.title).join('|') === 'mrvl new|mrvl old|nvda tariff|amd plain', ranked.map((r) => r.title).join('|'));
console.log('OK news logic');
