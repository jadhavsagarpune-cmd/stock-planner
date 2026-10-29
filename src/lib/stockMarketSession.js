/** US session helpers for extended-hours (pre / after) watchlist column. */

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

export function normalizeMarketState(state) {
  const s = String(state || '').trim().toUpperCase();
  if (s === 'PREPRE') return 'PRE';
  if (s === 'POSTPOST') return 'POST';
  return s || null;
}

/** When Yahoo reports CLOSED, pick pre vs after from US equity calendar. */
export function closedExtendedModeByClock(now = new Date()) {
  const { dow, minutes } = easternParts(now);
  if (dow === 0 || dow === 6) return 'post';
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  if (minutes < open) return 'pre';
  if (minutes >= close) return 'post';
  return 'regular';
}

/**
 * Extended column mode for US watchlist: regular (hide/mute), pre, or post.
 * Uses quote marketState when present; clock fallback for Google (empty state) and CLOSED.
 */
export function resolveUsExtendedColumnMode(itemsOrState, now = new Date()) {
  const clockRegular = isUsRegularSessionByClock(now);
  const clockExt = closedExtendedModeByClock(now);

  if (typeof itemsOrState === 'string' || itemsOrState == null) {
    const n = normalizeMarketState(itemsOrState);
    if (clockRegular) return 'regular';
    if (n === 'POST') return 'post';
    if (n === 'PRE') return 'pre';
    if (n === 'REGULAR') return clockExt;
    if (n === 'CLOSED') return clockExt;
    return clockExt;
  }

  if (Array.isArray(itemsOrState)) {
    if (clockRegular) return 'regular';
    // Off regular hours, US clock beats stale Yahoo REGULAR/PRE on the aggregate.
    return clockExt;
  }

  return clockRegular ? 'regular' : clockExt;
}

export function extendedColumnLabel(mode) {
  return mode === 'post' ? 'After hrs' : 'Pre';
}

export function isExtendedColumnMuted(mode) {
  return mode === 'regular';
}

export function isRegularMarketLive(marketState) {
  return resolveUsExtendedColumnMode(marketState) === 'regular';
}

/** @deprecated use resolveUsExtendedColumnMode + isExtendedColumnMuted */
export function shouldMutePreMarketColumn(itemsOrState) {
  return isExtendedColumnMuted(resolveUsExtendedColumnMode(itemsOrState));
}
