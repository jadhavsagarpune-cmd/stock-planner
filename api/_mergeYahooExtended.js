export const YAHOO_EXTENDED_FIELD_KEYS = [
  'postMarketPrice',
  'postMarketChange',
  'postMarketChangePercent',
  'postMarketTime',
  'preMarketPrice',
  'preMarketChange',
  'preMarketChangePercent',
  'preMarketTime',
  'currentPrice',
  'fulldayPrice',
  'regularMarketTime',
];

export function mergeYahooExtendedFields(base, yahooMeta) {
  if (!base || !yahooMeta) return base;
  const out = { ...base };
  for (const key of YAHOO_EXTENDED_FIELD_KEYS) {
    if (yahooMeta[key] != null) out[key] = yahooMeta[key];
  }
  if (
    (yahooMeta.postMarketPrice != null || yahooMeta.preMarketPrice != null)
    && yahooMeta.marketState
  ) {
    out.marketState = yahooMeta.marketState;
  }
  return out;
}

export async function yahooChartMetaForSymbol(sym, yahooFetch) {
  const chartPath = `/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=true`;
  try {
    const upstream = await yahooFetch(chartPath);
    if (!upstream?.ok) return null;
    const payload = await upstream.json();
    return payload?.chart?.result?.[0]?.meta ?? null;
  } catch {
    return null;
  }
}