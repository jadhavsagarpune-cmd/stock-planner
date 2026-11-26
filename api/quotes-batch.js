import { yahooFetch, fetchStooqQuoteMeta } from './_yahooUpstream.js';
import { fetchChartQuoteRow } from './_chartQuote.js';

const MAX_SYMBOLS = 80;
const CONCURRENCY = 10;
const DEADLINE_MS = 22_000;

function parseSymbols(raw) {
  const s = Array.isArray(raw) ? raw[0] : raw || '';
  return String(s)
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const symbols = [...new Set(parseSymbols(req.query?.symbols))];
  if (!symbols.length) {
    res.status(400).json({ error: 'symbols required (comma-separated)' });
    return;
  }
  if (symbols.length > MAX_SYMBOLS) {
    res.status(400).json({ error: `max ${MAX_SYMBOLS} symbols per request` });
    return;
  }

  const started = Date.now();
  const bySymbol = {};
  const sources = {};

  async function one(sym) {
    let row = await fetchChartQuoteRow(sym, yahooFetch, { timeoutMs: 5_000 });
    if (row) {
      sources[sym] = 'yahoo_chart';
    } else if (Date.now() - started < DEADLINE_MS - 6_000) {
      row = await fetchStooqQuoteMeta(sym);
      if (row) sources[sym] = 'stooq';
    }
    if (row) bySymbol[sym] = row;
  }

  try {
    let idx = 0;
    const worker = async () => {
      while (idx < symbols.length && Date.now() - started < DEADLINE_MS) {
        const sym = symbols[idx];
        idx += 1;
        try {
          await one(sym);
        } catch {
          /* symbol stays missing */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker));

    const found = Object.keys(bySymbol);
    res.setHeader(
      'Cache-Control',
      found.length ? 's-maxage=20, stale-while-revalidate=60' : 'no-store',
    );
    res.setHeader('X-Quote-Source', found.length ? 'mixed' : 'empty');
    res.status(200).json({
      quoteResponse: { result: symbols.map((sym) => bySymbol[sym]).filter(Boolean) },
      symbols,
      found,
      sources,
      missing: symbols.filter((s) => !bySymbol[s]),
    });
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}
