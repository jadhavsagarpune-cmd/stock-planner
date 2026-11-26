/** Yahoo v7/chart extended-hours fields Stooq must not mask. */
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

export function isStooqFallbackMeta(row) {
  return row?.source === 'stooq_fallback';
}

/** Overlay Yahoo extended ticks onto a Stooq (or partial) meta object. */
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