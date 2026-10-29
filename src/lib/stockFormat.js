/** Pre vs last regular session price (not vs prior close). */
export function preChangePctVsRegular(premarketPrice, regularPrice) {
  if (premarketPrice == null || regularPrice == null) return null;
  const pre = Number(premarketPrice);
  const reg = Number(regularPrice);
  if (Number.isNaN(pre) || Number.isNaN(reg) || reg === 0) return null;
  return ((pre - reg) / reg) * 100;
}

export function formatChangePct(pct) {
  if (pct == null || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

const CURRENCY_FRACTIONS = {
  KRW: 0,
  JPY: 0,
};

/** Extended-hours cell for watchlist row (pre or after session). */
export function pickExtendedQuote(it, mode) {
  if (!it || mode === 'regular') return null;
  if (mode === 'post') {
    const price = it.postmarket_price ?? it.premarket_price;
    let pct = it.postmarket_change_pct;
    if (pct == null && price != null && it.regular_price != null) {
      pct = preChangePctVsRegular(price, it.regular_price);
    }
    return { price, pct };
  }
  const price = it.premarket_price;
  let pct = preChangePctVsRegular(price, it.regular_price);
  if (pct == null) pct = it.premarket_change_pct;
  return { price, pct };
}

export function formatStockPrice(price, currency = 'USD') {
  if (price == null || Number.isNaN(Number(price))) return '—';
  const cur = (currency || 'USD').toUpperCase();
  const frac = CURRENCY_FRACTIONS[cur] ?? 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    }).format(Number(price));
  } catch {
    return `${cur} ${Number(price).toFixed(frac)}`;
  }
}
