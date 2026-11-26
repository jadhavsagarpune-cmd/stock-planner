import { fetchWithTimeout } from './_fetchUtils.js';

const STOOQ_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/csv,text/plain,*/*',
};

/** Yahoo ticker → Stooq `s=` query (lowercase). */
export function yahooSymbolToStooq(symbol) {
  const s = String(symbol || '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'INR=X' || s === 'USDINR=X') return 'usd/inr';
  if (s.endsWith('.KS')) return `${s.replace('.KS', '')}.kr`;
  if (s.includes('.')) return s.toLowerCase();
  return `${s.toLowerCase()}.us`;
}

/**
 * Parse Stooq `q/l` CSV; last row is latest tick.
 * @returns {{ close: number, open: number, high: number, low: number, rows: number } | null}
 */
export function parseStooqCsv(text) {
  const lines = String(text || '')
    .trim()
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('<'));
  if (lines.length < 2) return null;
  const dataLines = lines.slice(1);
  const parsed = [];
  for (const line of dataLines) {
    const cols = line.split(',');
    if (cols.length < 7) continue;
    const close = Number(cols[6]);
    const open = Number(cols[3]);
    const high = Number(cols[4]);
    const low = Number(cols[5]);
    if (!Number.isFinite(close) || close <= 0) continue;
    parsed.push({ close, open, high, low });
  }
  if (!parsed.length) return null;
  // Stooq `q/l` lists the latest tick first (then older rows).
  const last = parsed[0];
  const prev = parsed.length > 1 ? parsed[1] : null;
  return { ...last, prevClose: prev?.close ?? null, rows: parsed.length };
}

/** Build Yahoo-shaped chart meta from Stooq last tick (fallback when Yahoo blocks). */
export function stooqMetaFromSymbol(symbol, stooqData) {
  const sym = String(symbol || '').trim().toUpperCase();
  const { close, prevClose, open, high, low } = stooqData;
  const prev = prevClose ?? close;
  const chg = close - prev;
  const chgPct = prev > 0 ? (chg / prev) * 100 : 0;
  const currency = sym === 'INR=X' ? 'INR' : sym.endsWith('.KS') ? 'KRW' : 'USD';
  return {
    symbol: sym,
    currency,
    marketState: 'CLOSED',
    regularMarketPrice: close,
    regularMarketPreviousClose: prev,
    previousClose: prev,
    regularMarketChange: chg,
    regularMarketChangePercent: chgPct,
    regularMarketOpen: open ?? close,
    regularMarketDayHigh: high ?? close,
    regularMarketDayLow: low ?? close,
    currentPrice: close,
    chartPreviousClose: prev,
    source: 'stooq_fallback',
  };
}

/**
 * @returns {Promise<object | null>} Yahoo chart meta object or null
 */
export async function fetchStooqQuoteMeta(symbol) {
  const stooqSym = yahooSymbolToStooq(symbol);
  if (!stooqSym) return null;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=csv`;
  try {
    const resp = await fetchWithTimeout(url, { headers: STOOQ_HEADERS }, 4_000);
    if (!resp.ok) return null;
    const text = await resp.text();
    const data = parseStooqCsv(text);
    if (!data) return null;
    return stooqMetaFromSymbol(symbol, data);
  } catch {
    return null;
  }
}