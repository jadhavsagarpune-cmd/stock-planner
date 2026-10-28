/** When true, extended-hours Pre column is stale — grey out in watchlist UI. */

const REGULAR_STATES = new Set(['REGULAR']);

function easternParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const wd = get('weekday');
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dow: dayMap[wd] ?? 0, minutes: hour * 60 + minute };
}

/** US listed equities regular session (NYSE/Nasdaq), Mon–Fri 9:30–16:00 ET. */
export function isUsRegularSessionByClock(now = new Date()) {
  const { dow, minutes } = easternParts(now);
  if (dow === 0 || dow === 6) return false;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  return minutes >= open && minutes < close;
}

export function isRegularMarketLive(marketState) {
  const s = String(marketState || '').trim().toUpperCase();
  if (REGULAR_STATES.has(s)) return true;
  if (s === 'PRE' || s === 'PREPRE' || s === 'POST' || s === 'POSTPOST' || s === 'CLOSED') {
    return false;
  }
  return isUsRegularSessionByClock();
}

/** Grey Pre column when regular session is live (per quote or watchlist aggregate). */
export function shouldMutePreMarketColumn(itemsOrState) {
  if (typeof itemsOrState === 'string' || itemsOrState == null) {
    return isRegularMarketLive(itemsOrState);
  }
  if (Array.isArray(itemsOrState)) {
    const states = itemsOrState
      .map((it) => String(it.market_state || '').trim().toUpperCase())
      .filter(Boolean);
    if (states.some((s) => REGULAR_STATES.has(s))) return true;
    if (states.some((s) => s === 'PRE' || s === 'PREPRE')) return false;
    if (states.some((s) => s === 'POST' || s === 'POSTPOST')) return false;
  }
  return isUsRegularSessionByClock();
}
