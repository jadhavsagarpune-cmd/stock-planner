import {
  deriveExtendedChangeAbs,
  deriveRegularChangeAbsFromRow,
  preChangePctVsRegular,
} from './stockFormat.js';
import {
  closedExtendedModeByClock,
  isUsRegularSessionByClock,
  normalizeMarketState,
} from './stockMarketSession.js';

function float(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** PRE | REG | POST | CLOSED for UI chip (Yahoo metadata + US clock fallback). */
export function marketStatusChip(quote, now = new Date()) {
  if (!quote) return 'CLOSED';
  const state = normalizeMarketState(quote.market_state);
  const clockRegular = isUsRegularSessionByClock(now);

  if (state === 'PRE') return 'PRE';
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
  const c = float(quote?.current_price);
  const r = float(quote?.regular_price);
  if (c == null || r == null || Math.abs(c - r) < 0.005) return null;
  return c;
}

/**
 * Headline price for the active US session (Yahoo / Google semantics).
 */
export function pickActiveSessionPrice(quote, now = new Date()) {
  if (!quote) return null;
  const session = resolveActiveSession(quote, now);
  const regular = float(quote.regular_price);
  const previousClose = float(quote.previous_close);
  const pre = float(quote.premarket_price) ?? (session === 'pre' ? extendedCurrentPrice(quote) : null);
  const post =
    float(quote.postmarket_price)
    ?? float(quote.fullday_price)
    ?? (session === 'post' ? extendedCurrentPrice(quote) : null);
  const current = float(quote.current_price);

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
  const session = resolveActiveSession(quote, now);
  if (session === 'pre') return 'Pre-market';
  if (session === 'post') return 'After-hours';
  if (session === 'regular') return 'Regular session';
  return 'At close';
}

/** @deprecated use sessionHeadlineLabel */
export function activeSessionPriceLabel(quote, now = new Date()) {
  return sessionHeadlineLabel(quote, now);
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
    let pct = float(quote.premarket_change_pct);
    if (pct == null && price != null && previousClose != null) {
      pct = ((price - previousClose) / previousClose) * 100;
    }
    let abs = float(quote.premarket_change_abs);
    if (abs == null && price != null && previousClose != null) abs = price - previousClose;
    abs = deriveExtendedChangeAbs(price, previousClose, pct) ?? abs;
    if (pct == null && abs == null) return null;
    return { pct, abs, referenceLabel: 'Pre-market vs prior close' };
  }

  if (session === 'post') {
    const price =
      float(quote.postmarket_price)
      ?? float(quote.fullday_price)
      ?? extendedCurrentPrice(quote)
      ?? float(quote.current_price);
    let pct = float(quote.postmarket_change_pct);
    if (pct == null && price != null && regular != null) {
      pct = preChangePctVsRegular(price, regular);
    }
    let abs = float(quote.postmarket_change_abs);
    if (abs == null) abs = deriveExtendedChangeAbs(price, regular, pct);
    if (pct == null && abs == null) return null;
    return { pct, abs, referenceLabel: 'After-hours vs regular close' };
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
