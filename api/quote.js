import { yahooFetch, yahooChartOrFallback } from './_yahooUpstream.js';
import { enrichChartPayload } from './_chartQuote.js';

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
    let payload = null;
    let source = 'yahoo';

    const upstream = await yahooFetch(path, { timeoutMs: 6_000, attemptsPerHost: 1 });
    if (upstream?.ok) {
      payload = await upstream.json();
      const meta = payload?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice != null || meta?.previousClose != null || meta?.chartPreviousClose != null) {
        source = 'yahoo';
      } else {
        payload = null;
      }
    }

    if (!payload?.chart?.result?.length) {
      const pack = await yahooChartOrFallback(symbol);
      if (pack?.payload) {
        payload = pack.payload;
        source = pack.kind === 'stooq' ? 'stooq' : 'yahoo';
      }
    }

    if (!payload?.chart?.result?.length) {
      res.status(502).json({ error: 'No quote data from Yahoo or Stooq fallback' });
      return;
    }

    if (source === 'yahoo' && interval.endsWith('m') && range === '1d') {
      enrichChartPayload(payload, symbol);
    }

    const shortRange =
      interval.endsWith('m') || range === '1d' || range === '5d' || range === '7d';
    res.setHeader('X-Quote-Source', source);
    res.setHeader(
      'Cache-Control',
      source === 'stooq'
        ? 's-maxage=60, stale-while-revalidate=120'
        : shortRange
          ? 's-maxage=15, stale-while-revalidate=45'
          : 's-maxage=30, stale-while-revalidate=60',
    );
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}