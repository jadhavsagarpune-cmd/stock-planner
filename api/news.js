import { fetchWithTimeout } from './_fetchUtils.js';
import { UPSTREAM_HEADERS } from './_yahooUpstream.js';
import { buildNews, parseGoogleRss, parseYahooNews } from './_newsLogic.js';
import { addSummaries } from './_newsSummary.js';

const CONCURRENCY = 6;
const DEADLINE_MS = 20_000;
const MAX_SYMBOLS = 70;
const EXTRA = ['SPY', 'SOXX'];

function parseSymbols(raw) {
  const s = Array.isArray(raw) ? raw[0] : raw || '';
  return String(s)
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[A-Z0-9.^=-]{1,12}$/.test(x));
}

async function yahooNews(sym) {
  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      const r = await fetchWithTimeout(
        `https://${host}/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=10&quotesCount=0`,
        { headers: UPSTREAM_HEADERS },
        5_000,
      );
      if (r.ok) return parseYahooNews(await r.json(), sym);
    } catch {
      /* try next host */
    }
  }
  return null;
}

async function googleNews() {
  try {
    const r = await fetchWithTimeout(
      'https://news.google.com/rss/search?q=Marvell+Technology+MRVL&hl=en-US&gl=US&ceid=US:en',
      { headers: { 'User-Agent': UPSTREAM_HEADERS['User-Agent'] } },
      6_000,
    );
    return r.ok ? parseGoogleRss(await r.text(), 'MRVL') : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const started = Date.now();
  const extra = parseSymbols(req.query?.symbols).slice(0, MAX_SYMBOLS);
  const symbols = [...new Set(['MRVL', ...extra, ...EXTRA])];
  const raw = [];
  let okCount = 0;
  let source = 'yahoo';
  try {
    let idx = 0;
    const worker = async () => {
      while (idx < symbols.length && Date.now() - started < DEADLINE_MS) {
        const sym = symbols[idx];
        idx += 1;
        const rows = await yahooNews(sym);
        if (rows) {
          okCount += 1;
          raw.push(...rows);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (!raw.length) {
      source = 'google';
      raw.push(...(await googleNews()));
    }
    const { items, windowHours } = buildNews(raw);
    const withSummary = await addSummaries(items.slice(0, 40));
    const final = [...withSummary, ...items.slice(40)];
    res.setHeader('Cache-Control', final.length ? 's-maxage=300, stale-while-revalidate=600' : 'no-store');
    res.status(200).json({
      items: final,
      windowHours,
      source,
      queried: symbols.length,
      ok: okCount,
      summaries: final.some((i) => i.summary),
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ items: [] });
  }
}
