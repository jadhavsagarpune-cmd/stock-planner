import {
  closedExtendedModeByClock,
  isNyseFullMarketHoliday,
  isUsRegularSessionByClock,
  normalizeMarketState,
} from './stockMarketSession.js';
import { isDisplayablePrice } from './quoteResilience.js';

/** Watchlist helper copy (Yahoo column semantics). */
export const WATCHLIST_YAHOO_LEGEND =
  'Two columns: Previous Close + session price (Pre-market · Live · After Market) — labels change with the US session';

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

function isYahooPreMarketState(marketState) {
  const s = String(marketState || '').trim().toUpperCase();
  return s === 'PRE' || s === 'PREPRE';
}

function isYahooPostMarketState(marketState) {
  const s = String(marketState || '').trim().toUpperCase();
  return s === 'POST' || s === 'POSTPOST' || s === 'CLOSED';
}

function derivePctFromBase(price, base) {
  if (price == null || base == null || Number(base) === 0) return null;
  const p = Number(price);
  const b = Number(base);
  if (Number.isNaN(p) || Number.isNaN(b)) return null;
  return ((p - b) / b) * 100;
}

/** Pre/post % baseline: last regular session close (Yahoo “At close”), not prior trading day. */
function pickExtendedBaseline(it) {
  const regular = it?.regular_price;
  if (regular != null) {
    const r = Number(regular);
    if (Number.isFinite(r) && r > 0) return r;
  }
  const prev = it?.previous_close;
  if (prev == null) return null;
  const p = Number(prev);
  return Number.isFinite(p) && p > 0 ? p : null;
}

/** Extended-hours cell for watchlist row (pre or after session). */
export function pickExtendedQuote(it, mode) {
  if (!it || mode === 'regular') return null;
  if (mode === 'post') {
    const liveExt = currentExtendedPrice(it);
    const price =
      it.postmarket_price
      ?? it.fullday_price
      ?? (isYahooPostMarketState(it.market_state) || !isYahooPreMarketState(it.market_state) ? liveExt : null);
    if (price == null) return null;
    const base = pickExtendedBaseline(it);
    let pct = null;
    let abs = null;
    if (base != null) {
      pct = derivePctFromBase(price, base);
      abs = deriveExtendedChangeAbs(price, base, pct);
    } else {
      pct = it.postmarket_change_pct;
      abs = it.postmarket_change_abs;
      if (abs == null && pct != null && it.previous_close != null) {
        abs = deriveExtendedChangeAbs(price, it.previous_close, pct);
      }
    }
    return { price, pct, abs };
  }
  const price =
    it.premarket_price
    ?? (isYahooPreMarketState(it.market_state) ? currentExtendedPrice(it) : null);
  if (price == null) return null;
  const base = pickExtendedBaseline(it);
  let pct = null;
  let abs = null;
  if (base != null) {
    pct = derivePctFromBase(price, base);
    abs = deriveExtendedChangeAbs(price, base, pct);
  } else {
    pct = it.premarket_change_pct;
    abs = it.premarket_change_abs;
    if (abs == null && pct != null && it.previous_close != null) {
      abs = deriveExtendedChangeAbs(price, it.previous_close, pct);
    }
  }
  return { price, pct, abs };
}

/**
 * Regular Market watchlist column: live tick during US regular session; else session close + day % vs prev.
 */
export function pickRegularMarketDisplay(it, now = new Date()) {
  if (!it) return null;
  const sym = String(it.name || it.symbol || '').trim().toUpperCase();
  const isKrx = sym.endsWith('.KS');
  const previousClose = it.previous_close;
  const state = normalizeMarketState(it.market_state);
  const usRegularLive =
    isUsRegularSessionByClock(now)
    && !isKrx
    && state === 'REGULAR';

  if (usRegularLive) {
    const price =
      it.current_price != null ? Number(it.current_price) : Number(it.regular_price);
    if (price == null || Number.isNaN(price)) return null;
    let pct = it.regular_change_pct;
    let abs = it.regular_change_abs;
    if (previousClose != null && Number(previousClose) !== 0) {
      pct = ((price - previousClose) / previousClose) * 100;
      abs = deriveExtendedChangeAbs(price, previousClose, pct);
    } else {
      abs = deriveRegularChangeAbsFromRow(it);
    }
    return { price, pct, abs, live: true };
  }

  if (!isKrx && isNyseFullMarketHoliday(now)) {
    const price = it.regular_price ?? it.previous_close;
    if (!isDisplayablePrice(price)) return null;
    return {
      price: Number(price),
      pct: it.regular_change_pct,
      abs: deriveRegularChangeAbsFromRow(it),
      live: false,
    };
  }

  const clockPre = !isKrx && closedExtendedModeByClock(now) === 'pre';
  const yahooPre = state === 'PRE';
  const inUsPre = clockPre || yahooPre;

  if (inUsPre) {
    // Regular session is not open — prior close lives only in the Previous Close column.
    return { price: null, pct: null, abs: null, live: false, preIdle: true };
  }

  const price = it.regular_price;
  if (price == null) return null;

  const priceN = Number(price);

  return {
    price: priceN,
    pct: it.regular_change_pct,
    abs: deriveRegularChangeAbsFromRow(it),
    live: false,
  };
}

/** % change used for session heatmap tiles (live vs pre vs after-hours). */
export function pickHeatmapChangePct(it, sessionMode) {
  if (!it || it.status !== 'done') return null;
  const sym = String(it.name || '').trim().toUpperCase();
  const hasPrice = pickHeatmapPrice(it, sessionMode) != null;
  if (!hasPrice) {
    const n = Number(it.regular_change_pct);
    if (it.regular_change_pct == null || Number.isNaN(n)) return null;
    if (n === 0 && !isDisplayablePrice(it.previous_close)) return null;
    if (sym.endsWith('.KS') || sessionMode === 'regular') return n;
    return null;
  }
  if (sym.endsWith('.KS') || sessionMode === 'regular') {
    const n = Number(it.regular_change_pct);
    return it.regular_change_pct == null || Number.isNaN(n) ? null : n;
  }
  const ext = pickExtendedQuote(it, sessionMode);
  if (ext?.pct != null && !Number.isNaN(Number(ext.pct))) return Number(ext.pct);
  const n = Number(it.regular_change_pct);
  return it.regular_change_pct == null || Number.isNaN(n) ? null : n;
}

/** Session price for heatmap hover (matches pickHeatmapChangePct session). */
export function pickHeatmapPrice(it, sessionMode) {
  if (!it || it.status !== 'done') return null;
  const sym = String(it.name || '').trim().toUpperCase();
  if (sym.endsWith('.KS') || sessionMode === 'regular') {
    const candidates = [it.regular_price, it.previous_close, it.current_price, it.fullday_price];
    for (const p of candidates) {
      if (isDisplayablePrice(p)) return Number(p);
    }
    return null;
  }
  const ext = pickExtendedQuote(it, sessionMode);
  const price = ext?.price ?? it.regular_price;
  return price == null || Number.isNaN(Number(price)) ? null : Number(price);
}

export function formatHeatmapTileTitle(label, it, pct, sessionMode, sessionBadge) {
  const parts = [label];
  const price = pickHeatmapPrice(it, sessionMode);
  const priceStr = formatStockPrice(price, it?.currency);
  if (priceStr && priceStr !== '—') parts.push(priceStr);
  const pctStr = formatChangePct(pct);
  if (pctStr) parts.push(pctStr);
  if (sessionBadge) parts.push(`(${sessionBadge})`);
  return parts.join(' · ');
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
  const n = Number(price);
  if (!isDisplayablePrice(n)) return '—';
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
