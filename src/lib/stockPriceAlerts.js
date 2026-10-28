import { formatChangePct, preChangePctVsRegular } from './stockFormat';
import { isRegularMarketLive } from './stockMarketSession';

export const MRVL_SYMBOL = 'MRVL';
export const MRVL_MOVE_ALERT_PCT = 5;
export const OTHER_MOVE_ALERT_PCT = 10;

const NOTIFY_KEY = 'stock_planner_desktop_notify';
const ALERT_STORAGE_PREFIX = 'stock_planner_alert_';
const RE_ALERT_DELTA_PCT = 1;
const ALERT_HYSTERESIS_PCT = 0.75;

export function getDesktopNotificationsEnabled() {
  try {
    return localStorage.getItem(NOTIFY_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDesktopNotificationsEnabled(on) {
  try {
    if (on) localStorage.setItem(NOTIFY_KEY, '1');
    else localStorage.removeItem(NOTIFY_KEY);
  } catch { /* ignore */ }
}

export function moveThresholdPct(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  return sym === MRVL_SYMBOL ? MRVL_MOVE_ALERT_PCT : OTHER_MOVE_ALERT_PCT;
}

function storageKey(symbol, kind) {
  return `${ALERT_STORAGE_PREFIX}${symbol}_${kind}`;
}

function readLastAlertedPct(symbol, kind) {
  try {
    const raw = sessionStorage.getItem(storageKey(symbol, kind));
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastAlertedPct(symbol, kind, pct) {
  try {
    sessionStorage.setItem(storageKey(symbol, kind), String(pct));
  } catch { /* ignore */ }
}

function clearLastAlertedPct(symbol, kind) {
  try {
    sessionStorage.removeItem(storageKey(symbol, kind));
  } catch { /* ignore */ }
}

export function priceMovesForQuote(quote) {
  if (!quote) return [];
  const moves = [];
  const reg = quote.regular_change_pct;
  if (reg != null && !Number.isNaN(Number(reg))) {
    moves.push({ kind: 'regular', pct: Number(reg) });
  }
  const preFromApi = quote.premarket_change_pct;
  const preDerived = preChangePctVsRegular(quote.premarket_price, quote.regular_price);
  let prePct = preFromApi != null && !Number.isNaN(Number(preFromApi))
    ? Number(preFromApi)
    : preDerived;
  if (prePct != null && quote.premarket_price != null && !Number.isNaN(Number(prePct))) {
    moves.push({ kind: 'premarket', pct: Number(prePct) });
  }
  return moves;
}

export function shouldFireStockMoveAlert(symbol, kind, pct, threshold) {
  if (pct == null || Number.isNaN(pct)) return false;
  const abs = Math.abs(pct);
  if (abs < threshold) {
    if (abs < threshold - ALERT_HYSTERESIS_PCT) {
      clearLastAlertedPct(symbol, kind);
    }
    return false;
  }
  const prev = readLastAlertedPct(symbol, kind);
  if (prev != null) {
    const sameSign = Math.sign(prev) === Math.sign(pct) || pct === 0;
    if (sameSign && Math.abs(pct - prev) < RE_ALERT_DELTA_PCT) {
      return false;
    }
  }
  writeLastAlertedPct(symbol, kind, pct);
  return true;
}

function sessionKindLabel(kind) {
  return kind === 'premarket' ? 'Pre-market' : 'Regular session';
}

export function notifyStockMoveIfNeeded({ symbol, label, quote }) {
  if (!getDesktopNotificationsEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const sym = String(symbol || quote?.symbol || '').trim().toUpperCase();
  if (!sym) return;
  const threshold = moveThresholdPct(sym);
  const display = label || sym;
  const marketState = quote?.market_state;

  for (const { kind, pct } of priceMovesForQuote(quote)) {
    if (kind === 'premarket' && isRegularMarketLive(marketState)) continue;
    if (!shouldFireStockMoveAlert(sym, kind, pct, threshold)) continue;
    const dir = pct > 0 ? 'up' : 'down';
    const pctStr = formatChangePct(pct) || `${pct.toFixed(2)}%`;
    const title = `${display} ${dir} ${pctStr}`;
    const body = `${sessionKindLabel(kind)} move ≥ ${threshold}%`;
    try {
      new Notification(title, { body, tag: `stock-${sym}-${kind}` });
    } catch { /* quota */ }
  }
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const p = await Notification.requestPermission();
  return p;
}
