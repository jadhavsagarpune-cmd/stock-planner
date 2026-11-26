/** Stock quote numeric field: must be a positive finite number (never show $0.00 for missing data). */
export function isDisplayablePrice(value) {
  if (value == null) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/** Null out non-positive price fields on a mapped quote row. */
export function sanitizeQuotePrices(quote) {
  if (!quote || typeof quote !== 'object') return quote;
  const priceKeys = [
    'previous_close',
    'regular_price',
    'current_price',
    'premarket_price',
    'postmarket_price',
    'fullday_price',
    'regular_market_open',
    'day_high',
    'day_low',
  ];
  const out = { ...quote };
  for (const key of priceKeys) {
    if (key in out && !isDisplayablePrice(out[key])) out[key] = null;
  }
  return out;
}

/** True when the hero/watchlist has at least one price to show. */
export function quoteIsRenderable(quote) {
  if (!quote) return false;
  return (
    isDisplayablePrice(quote.regular_price)
    || isDisplayablePrice(quote.previous_close)
    || isDisplayablePrice(quote.postmarket_price)
    || isDisplayablePrice(quote.premarket_price)
    || isDisplayablePrice(quote.current_price)
    || isDisplayablePrice(quote.fullday_price)
  );
}

export function pickBestQuotePrice(quote) {
  if (!quote) return null;
  const candidates = [
    quote.postmarket_price,
    quote.premarket_price,
    quote.current_price,
    quote.fullday_price,
    quote.regular_price,
    quote.previous_close,
  ];
  for (const c of candidates) {
    if (isDisplayablePrice(c)) return Number(c);
  }
  return null;
}

export function formatQuoteFetchError(err) {
  const raw = String(err?.message || err || 'Quote failed');
  const http = raw.match(/Yahoo HTTP (\d{3})/i) || raw.match(/HTTP (\d{3})/i);
  if (http) {
    return `Prices not available for this symbol right now. (HTTP ${http[1]})`;
  }
  return `Prices not available for this symbol right now. (${raw})`;
}