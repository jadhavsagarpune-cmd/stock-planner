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

/** Yahoo-style signed dollar/local change (e.g. -30.40, +1.23). */
export function formatSignedChangeAmount(amount, currency = 'USD') {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  const n = Number(amount);
  const cur = (currency || 'USD').toUpperCase();
  const frac = CURRENCY_FRACTIONS[cur] ?? 2;
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(frac)}`;
}

export function formatChangePctParen(pct) {
  const inner = formatChangePct(pct);
  if (!inner) return null;
  return `(${inner})`;
}

export function changeColorClass(pct) {
  const n = Number(pct);
  if (Number.isNaN(n) || pct == null) return 'text-slate-500';
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-slate-500';
}

export function deriveRegularChangeAbsFromRow(it) {
  if (!it) return null;
  let abs = null;
  if (it.regular_change_abs != null) abs = Number(it.regular_change_abs);
  else {
    const price = it.regular_price;
    const prev = it.previous_close;
    if (price != null && prev != null) abs = price - prev;
    else {
      const pct = it.regular_change_pct;
      if (pct != null && prev != null) abs = (pct / 100) * prev;
      else if (pct != null && price != null) {
        const prior = price / (1 + pct / 100);
        if (Number.isFinite(prior)) abs = price - prior;
      }
    }
  }
  return alignChangeAbsWithPctLocal(abs, it.regular_change_pct);
}

function alignChangeAbsWithPctLocal(changeAbs, changePct) {
  if (changeAbs == null || changePct == null) return changeAbs;
  const abs = Number(changeAbs);
  const pct = Number(changePct);
  if (!Number.isFinite(abs) || !Number.isFinite(pct)) return changeAbs;
  if (pct === 0) return 0;
  if (pct > 0 && abs < 0) return Math.abs(abs);
  if (pct < 0 && abs > 0) return -Math.abs(abs);
  return abs;
}

export function deriveExtendedChangeAbs(price, basePrice, pct) {
  if (price == null || basePrice == null) return null;
  let abs = Number(price) - Number(basePrice);
  if (!Number.isFinite(abs)) return null;
  if (pct != null) {
    const p = Number(pct);
    if (Number.isFinite(p)) {
      if (p === 0) abs = 0;
      else if (p > 0 && abs < 0) abs = Math.abs(abs);
      else if (p < 0 && abs > 0) abs = -Math.abs(abs);
    }
  }
  return abs;
}

const CURRENCY_FRACTIONS = {
  KRW: 0,
  JPY: 0,
};

function currentExtendedPrice(it) {
  const c = it.current_price;
  const r = it.regular_price;
  if (c == null || r == null || c === r) return null;
  return c;
}

/** Extended-hours cell for watchlist row (pre or after session). */
export function pickExtendedQuote(it, mode) {
  if (!it || mode === 'regular') return null;
  if (mode === 'post') {
    const price =
      it.postmarket_price ?? it.fullday_price ?? currentExtendedPrice(it) ?? it.premarket_price;
    let pct = it.postmarket_change_pct;
    if (pct == null && price != null && it.regular_price != null) {
      pct = preChangePctVsRegular(price, it.regular_price);
    }
    const abs = deriveExtendedChangeAbs(price, it.regular_price, pct);
    return { price, pct, abs };
  }
  const price = it.premarket_price ?? currentExtendedPrice(it);
  let pct = preChangePctVsRegular(price, it.regular_price);
  if (pct == null) pct = it.premarket_change_pct;
  const abs = deriveExtendedChangeAbs(price, it.regular_price, pct);
  return { price, pct, abs };
}

export function formatInr(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/** MRVL-only inline hint: USD share price × USD/INR spot. */
export function formatMrvlInrHint(priceUsd, fxRate) {
  const usd = Number(priceUsd);
  const fx = Number(fxRate);
  if (!Number.isFinite(usd) || !Number.isFinite(fx) || fx <= 0) return null;
  return formatInr(usd * fx);
}

/** MRVL-only: USD session change × USD/INR spot. */
export function formatMrvlInrChangeHint(changeUsd, fxRate) {
  const ch = Number(changeUsd);
  const fx = Number(fxRate);
  if (!Number.isFinite(ch) || !Number.isFinite(fx) || fx <= 0) return null;
  return formatInr(ch * fx);
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
