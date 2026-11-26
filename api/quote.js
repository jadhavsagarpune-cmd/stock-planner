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

  const rawRange = req.query?.range;
  const rawInterval = req.query?.interval;
  const range = (Array.isArray(rawRange) ? rawRange[0] : rawRange || '1d').trim();
  const interval = (Array.isArray(rawInterval) ? rawInterval[0] : rawInterval || '1m').trim();
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=true`;

  try {
    let upstream = await yahooFetch(path);
    let payload = null;
    if (upstream?.ok) {
      payload = await upstream.json();
    } else {
      const v7Path = `/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const v7 = await yahooFetch(v7Path);
      if (v7?.ok) {
        const v7Json = await v7.json();
        const row = v7Json?.quoteResponse?.result?.[0];
        if (row) {
          payload = {
            chart: {
              result: [
                {
                  meta: row,
                  timestamp: [],
                  indicators: { quote: [{ close: [], open: [], high: [], low: [], volume: [] }] },
                },
              ],
            },
          };
        }
      }
      if (!payload) {
        res.status(upstream?.status || 502).json({ error: `Yahoo HTTP ${upstream?.status || 502}` });
        return;
      }
    }
    const shortRange =
      interval.endsWith('m') || range === '1d' || range === '5d' || range === '7d';
    res.setHeader(
      'Cache-Control',
      shortRange ? 's-maxage=15, stale-while-revalidate=45' : 's-maxage=30, stale-while-revalidate=60',
    );
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}