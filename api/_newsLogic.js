/** Pure news helpers (server): parsing, dedupe, time window, categories. */

export const SEMIS = new Set([
  'NVDA', 'TSM', 'AVGO', '005930.KS', 'ASML', 'AMD', '000660.KS', 'MU', 'AMAT', 'LRCX', 'QCOM',
  'INTC', 'KLAC', 'TXN', 'ARM', 'ADI', 'CRDO', 'ALAB', 'MPWR', 'NXPI', 'MCHP', 'ON', 'GFS',
  'LITE', 'COHR', 'SOXX', 'SMH',
]);

const H = 3_600_000;

export function normTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/\s[-–—|]\s[^-–—|]{2,40}$/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(t) {
  return new Set(normTitle(t).split(' ').filter((w) => w.length > 2));
}

export function similarTitles(a, b) {
  const na = normTitle(a);
  const nb = normTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size < 4 || tb.size < 4) return false;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / (ta.size + tb.size - inter) >= 0.7;
}

/** Merge duplicates (same/similar title), union tickers, keep earliest-listed (newest) item. */
export function dedupeItems(items) {
  const out = [];
  for (const it of items) {
    const dup = out.find((o) => o.url === it.url || similarTitles(o.title, it.title));
    if (dup) {
      dup.tickers = [...new Set([...dup.tickers, ...it.tickers])];
      if (it.publishedAt > dup.publishedAt) dup.publishedAt = it.publishedAt;
    } else {
      out.push({ ...it, tickers: [...it.tickers] });
    }
  }
  return out;
}

export function categorize(item) {
  const tk = item.tickers || [];
  if (tk.includes('MRVL') || /\bmarvell\b/i.test(item.title)) return 'marvell';
  if (tk.some((s) => SEMIS.has(s)) || /\b(semiconductor|chipmaker|chips?)\b/i.test(item.title)) {
    return 'semis';
  }
  return 'market';
}

/**
 * Last 24h; if none, last 72h (weekend/holiday fallback).
 * @returns {{ items: object[], windowHours: number }}
 */
export function applyTimeWindow(items, now = Date.now()) {
  const within = (h) => items.filter((i) => i.publishedAt <= now + 5 * 60_000 && now - i.publishedAt <= h * H);
  const d1 = within(24);
  if (d1.length) return { items: d1, windowHours: 24 };
  return { items: within(72), windowHours: 72 };
}

/** Low-signal ETF flow / holdings filler. */
export function isNoise(title) {
  return /^(ETFs? (are )?(net )?(sellers|buyers|activity)|ETF Activity)|\b(adds|sells|sold|buys|bought) .* on nov\. \d+/i.test(title);
}

export function parseYahooNews(json, sym) {
  const list = Array.isArray(json?.news) ? json.news : [];
  const out = [];
  for (const n of list) {
    const title = String(n?.title || '').trim();
    const url = String(n?.link || '').trim();
    const ts = Number(n?.providerPublishTime);
    if (!title || isNoise(title) || !/^https?:\/\//.test(url) || !Number.isFinite(ts)) continue;
    const rel = Array.isArray(n.relatedTickers) ? n.relatedTickers.map(String) : [];
    out.push({
      title,
      publisher: String(n.publisher || '').trim(),
      url,
      publishedAt: ts * 1000,
      tickers: [...new Set([sym, ...rel].filter(Boolean).map((s) => s.toUpperCase()))].slice(0, 8),
    });
  }
  return out;
}

function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

export function parseGoogleRss(xml, sym) {
  const out = [];
  for (const m of String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const get = (tag) => {
      const r = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return r ? decode(r[1]) : '';
    };
    let title = get('title');
    const url = get('link');
    const ts = Date.parse(get('pubDate'));
    let publisher = get('source');
    const suffix = title.match(/^(.*)\s-\s([^-]{2,40})$/);
    if (suffix) {
      title = suffix[1].trim();
      publisher = publisher || suffix[2].trim();
    }
    if (!title || !/^https?:\/\//.test(url) || !Number.isFinite(ts)) continue;
    out.push({ title, publisher, url, publishedAt: ts, tickers: [sym] });
  }
  return out;
}

/** Full pipeline on raw items from all sources. */
export function buildNews(rawItems, now = Date.now()) {
  const sorted = [...rawItems].sort((a, b) => b.publishedAt - a.publishedAt);
  const { items, windowHours } = applyTimeWindow(dedupeItems(sorted), now);
  const withCat = items.map((i) => ({
    ...i,
    publishedAt: new Date(i.publishedAt).toISOString(),
    score: 0,
    category: categorize(i),
  }));
  return { items: withCat.slice(0, 80), windowHours };
}
