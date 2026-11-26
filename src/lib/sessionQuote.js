import { isDisplayablePrice } from './quoteResilience.js';
import { deriveExtendedChangeAbs, deriveRegularChangeAbsFromRow } from './stockFormat.js';
import {
  closedExtendedModeByClock,
  isNyseFullMarketHoliday,
  isUsRegularSessionByClock,
  normalizeMarketState,
  nyseHolidayLabel,
} from './stockMarketSession.js';

function float(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function priceFloat(v) {
  const n = float(v);
  return isDisplayablePrice(n) ? n : null;
}

/** PRE | REG | POST | CLOSED for UI chip (Yahoo metadata + US clock fallback). */
export function marketStatusChip(quote, now = new Date()) {
  if (!quote) return 'CLOSED';
  if (isNyseFullMarketHoliday(now)) return 'CLOSED';
  const state = normalizeMarketState(quote.market_state);
  const clockRegular = isUsRegularSessionByClock(now);

  if (state === 'PRE' && !isNyseFullMarketHoliday(now)) return 'PRE';
  if (state === 'POST') return 'POST';

  if (state === 'REGULAR') {
    if (clockRegular) return 'REG';
    const ext = closedExtendedModeByClock(now);
    if (ext === 'pre') return 'PRE';
    if (ext === 'post') return 'POST';
    return 'CLOSED';
  }

  if (state === 'CLOSED') {
    const ext = closedExtendedModeByClock(now);
    if (ext === 'pre') return 'PRE';
    if (ext === 'post') return 'POST';
    return 'CLOSED';
  }

  if (clockRegular) return 'REG';
  const ext = closedExtendedModeByClock(now);
  if (ext === 'pre') return 'PRE';
  if (ext === 'post') return 'POST';
  return 'CLOSED';
}

/** @returns {'pre'|'regular'|'post'|'closed'} */
export function resolveActiveSession(quote, now = new Date()) {
  const chip = marketStatusChip(quote, now);
  if (chip === 'PRE') return 'pre';
  if (chip === 'POST') return 'post';
  if (chip === 'REG') return 'regular';
  return 'closed';
}

function extendedCurrentPrice(quote) {
  const c = priceFloat(quote?.current_price);
  const r = priceFloat(quote?.regular_price);
  if (c == null || r == null || Math.abs(c - r) < 0.005) return null;
  return c;
}

/**
 * Headline price for the active US session (Yahoo / Google semantics).
 */
export function pickActiveSessionPrice(quote, now = new Date()) {
  if (!quote) return null;
  const session = resolveActiveSession(quote, now);
  const regular = priceFloat(quote.regular_price);
  const previousClose = priceFloat(quote.previous_close);
  const pre = priceFloat(quote.premarket_price) ?? (session === 'pre' ? extendedCurrentPrice(quote) : null);
  const post =
    priceFloat(quote.postmarket_price)
    ?? priceFloat(quote.fullday_price)
    ?? (session === 'post' ? extendedCurrentPrice(quote) : null);
  const current = priceFloat(quote.current_price);

  if (session === 'pre') {
    return pre ?? current ?? regular ?? previousClose;
  }
  if (session === 'post') {
    return post ?? current ?? regular;
  }
  if (session === 'regular') {
    return current ?? regular ?? previousClose;
  }
  return regular ?? previousClose ?? current;
}

/** User-facing headline label — one session name only (chip carries PRE/REG/POST). */
export function sessionHeadlineLabel(quote, now = new Date()) {
  if (!quote) return 'Price';
  if (isNyseFullMarketHoliday(now)) {
    const hol = nyseHolidayLabel(now);
    return hol ? `Market closed · ${hol}` : 'Market closed';
  }
  const session = resolveActiveSession(quote, now);
  if (session === 'pre') return 'Pre-market';
  if (session === 'post') return 'After Market';
  if (session === 'regular') return 'Regular Market';
  return 'At close';
}

/** @deprecated use sessionHeadlineLabel */
export function activeSessionPriceLabel(quote, now = new Date()) {
  return sessionHeadlineLabel(quote, now);
}

/** User-facing session pill (PRE / REG / POST / CLOSED from marketStatusChip). */
export function marketSessionDisplayLabel(chip) {
  switch (chip) {
    case 'PRE':
      return 'Pre-Market';
    case 'POST':
      return 'After Hours';
    case 'REG':
      return 'Live';
    default:
      return 'Closed';
  }
}

/**
 * Session-aligned day change (do not show regular day change under a pre headline).
 * @returns {{ pct: number|null, abs: number|null, referenceLabel: string }|null}
 */
export function pickSessionDayChange(quote, now = new Date()) {
  if (!quote) return null;
  const session = resolveActiveSession(quote, now);
  const previousClose = float(quote.previous_close);
  const regular = float(quote.regular_price);

  if (session === 'pre') {
    const price = float(quote.premarket_price) ?? extendedCurrentPrice(quote) ?? float(quote.current_price);
    const atClose = float(quote.regular_price) ?? previousClose;
    let pct = null;
    let abs = null;
    if (price != null && atClose != null && atClose !== 0) {
      pct = ((price - atClose) / atClose) * 100;
      abs = price - atClose;
    } else if (price != null) {
      pct = float(quote.premarket_change_pct);
      abs = float(quote.premarket_change_abs);
    }
    abs = deriveExtendedChangeAbs(price, atClose, pct) ?? abs;
    if (pct == null && abs == null) return null;
    return { pct, abs, referenceLabel: 'Pre-market vs at close' };
  }

  if (session === 'post') {
    const price =
      float(quote.postmarket_price)
      ?? float(quote.fullday_price)
      ?? extendedCurrentPrice(quote)
      ?? float(quote.current_price);
    let pct = null;
    let abs = null;
    const atClose = float(quote.regular_price) ?? float(quote.previous_close);
    if (price != null && atClose != null && atClose !== 0) {
      pct = ((price - atClose) / atClose) * 100;
      abs = price - atClose;
    } else if (price != null) {
      pct = float(quote.postmarket_change_pct);
      abs = float(quote.postmarket_change_abs);
    }
    abs = deriveExtendedChangeAbs(price, atClose, pct) ?? abs;
    if (pct == null && abs == null) return null;
    return { pct, abs, referenceLabel: 'After-hours vs at close' };
  }

  if (session === 'regular') {
    const pct = float(quote.regular_change_pct);
    const abs = deriveRegularChangeAbsFromRow(quote);
    if (pct == null && abs == null) return null;
    return { pct, abs, referenceLabel: 'Day change vs prior close' };
  }

  const pct = float(quote.regular_change_pct);
  const abs = deriveRegularChangeAbsFromRow(quote);
  if (pct == null && abs == null) return null;
  return { pct, abs, referenceLabel: 'At close vs prior close' };
}

/** @deprecated chart path — use pickActiveSessionPrice */
export function pickLiveChartPrice(quote, now = new Date()) {
  return pickActiveSessionPrice(quote, now);
}
