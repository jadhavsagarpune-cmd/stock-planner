const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';

const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

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
  const url = `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(symbol))}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=true`;

  try {
    const upstream = await fetch(url, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Yahoo HTTP ${upstream.status}` });
      return;
    }
    const payload = await upstream.json();
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
