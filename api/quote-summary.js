import { yahooFetch } from './_yahooUpstream.js';

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
    if (!upstream?.ok) {
      res.status(upstream?.status || 502).json({ error: `Yahoo HTTP ${upstream?.status || 502}` });
      return;
    }
    const payload = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45');
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}