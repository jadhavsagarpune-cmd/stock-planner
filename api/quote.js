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

  const url = `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(symbol))}?interval=1m&range=1d`;

  try {
    const upstream = await fetch(url, { headers: UPSTREAM_HEADERS });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Yahoo HTTP ${upstream.status}` });
      return;
    }
    const payload = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(payload);
  } catch (err) {
    res.status(502).json({ error: String(err?.message || err) });
  }
}
