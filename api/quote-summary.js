import { yahooFetch, fetchStooqQuoteMeta } from './_yahooUpstream.js';
import { fetchChartQuoteRow } from './_chartQuote.js';

function send(res, row, source, cache) {
  res.setHeader('X-Quote-Source', source);
  res.setHeader('Cache-Control', cache);
  res.status(200).json({ quoteResponse: { result: [row] }, _source: source });
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

  try {
    // Chart v8 first (works on Vercel; includes pre/post bars). v7 needs a crumb and often fails.
    const chartRow = await fetchChartQuoteRow(symbol, yahooFetch, { timeoutMs: 5_000 });
    if (chartRow) {
      send(res, chartRow, 'yahoo_chart', 's-maxage=15, stale-while-revalidate=45');
      return;
    }
    const stooq = await fetchStooqQuoteMeta(symbol);
    if (stooq) {
      send(res, stooq, 'stooq', 's-maxage=60, stale-while-revalidate=120');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'No quote from Yahoo chart or Stooq', quoteResponse: { result: [] } });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(err?.message || err), quoteResponse: { result: [] } });
  }
}
