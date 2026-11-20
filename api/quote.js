const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}';
const YAHOO_QUOTE_V7 = 'https://query1.finance.yahoo.com/v7/finance/quote';

const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  Accept-Language: 'en-US,en;q=0.9',
};

const V7_OVERLAY_KEYS = [
  'regularMarketPreviousClose',
  'previousClose',
  'regularMarketPrice',
  'regularMarketChange',
  'regularMarketChangePercent',
  'preMarketPrice',
  'preMarketChange',
  'preMarketChangePercent',
  'postMarketPrice',
  'postMarketChange',
  'postMarketChangePercent',
  'marketState',
];

function overlayV7Meta(chartMeta, v7Row) {
  if (!v7Row) return chartMeta;
  const out = { ...(chartMeta || {}) };
  for (const key of V7_OVERLAY_KEYS) {
    if (v7Row[key] != null) out[key] = v7Row[key];
  }
  if (v7Row.regularMarketPreviousClose != null) {
    out.regularMarketPreviousClose = v7Row.regularMarketPreviousClose;
  }
  return out;
}

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
  const chartUrl = `${YAHOO_CHART.replace('{symbol}', encodeURIComponent(symbol))}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=true`;
  const v7Url = `${YAHOO_QUOTE_V7}?symbols=${encodeURIComponent(symbol)}`;

  try {
    const [chartResp, v7Resp] = await Promise.all([
      fetch(chartUrl, { headers: UPSTREAM_HEADERS }),
      fetch(v7Url, { headers: UPSTREAM_HEADERS }),
    ]);
    if (!chartResp.ok) {
      res.status(chartResp.status).json({ error: `Yahoo chart HTTP ${chartResp.status}` });
      return;
    }
    const payload = await chartResp.json();
    const results = payload?.chart?.result;
    if (Array.isArray(results) && results.length && v7Resp.ok) {
      try {
        const v7 = await v7Resp.json();
        const row = v7?.quoteResponse?.result?.[0];
        if (row) {
          results[0].meta = overlayV7Meta(results[0].meta || {}, row);
        }
      } catch {
        /* chart-only fallback */
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