import { yahooFetch, fetchStooqQuoteMeta } from './_yahooUpstream.js';

const MAX_SYMBOLS = 80;
const CHUNK = 40;

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

  const bySymbol = {};
  const missing = new Set(symbols);

  try {
    for (let i = 0; i < symbols.length; i += CHUNK) {
      const chunk = symbols.slice(i, i + CHUNK);
      const path = `/v7/finance/quote?symbols=${encodeURIComponent(chunk.join(','))}`;
      try {
        const upstream = await yahooFetch(path);
        if (!upstream?.ok) continue;
        const payload = await upstream.json();
        const rows = payload?.quoteResponse?.result;
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const sym = String(row?.symbol || '').trim().toUpperCase();
          if (!sym) continue;
          bySymbol[sym] = row;
          missing.delete(sym);
        }
      } catch {
        /* chunk failed — per-symbol stooq below */
      }
    }

    await Promise.all(
      [...missing].map(async (sym) => {
        const meta = await fetchStooqQuoteMeta(sym);
        if (meta) bySymbol[sym] = meta;
      }),
    );

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');
    res.setHeader('X-Quote-Source', Object.keys(bySymbol).length ? 'mixed' : 'empty');
    res.status(200).json({
      quoteResponse: { result: symbols.map((sym) => bySymbol[sym]).filter(Boolean) },
      symbols,
      found: Object.keys(bySymbol),
    });
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}