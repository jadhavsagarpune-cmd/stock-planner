import { yahooFetch, fetchStooqQuoteMeta } from './_yahooUpstream.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const raw = req.query?.symbol;
  const symbol = (Array.isArray(raw) ? raw[0] : raw || '').trim().toUpperCase();
  if (!symbol) {
    res.status(400).json({ error: 'symbol required' });
    return;
  }

  const path = `/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

  try {
    const upstream = await yahooFetch(path);
    if (upstream?.ok) {
      const payload = await upstream.json();
      const row = payload?.quoteResponse?.result?.[0];
      if (row) {
        res.setHeader('X-Quote-Source', 'yahoo_v7');
        res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45');
        res.status(200).json(payload);
        return;
      }
    }
    const stooqMeta = await fetchStooqQuoteMeta(symbol);
    if (stooqMeta) {
      res.setHeader('X-Quote-Source', 'stooq');
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      res.status(200).json({
        quoteResponse: { result: [stooqMeta] },
        _source: 'stooq',
      });
      return;
    }
    res.status(upstream?.status || 502).json({
      error: `Yahoo HTTP ${upstream?.status || 502}`,
      quoteResponse: { result: [] },
    });
  } catch (err) {
    const stooqMeta = await fetchStooqQuoteMeta(symbol);
    if (stooqMeta) {
      res.setHeader('X-Quote-Source', 'stooq');
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      res.status(200).json({
        quoteResponse: { result: [stooqMeta] },
        _source: 'stooq',
      });
      return;
    }
    res.status(502).json({ error: String(err?.message || err) });
  }
}