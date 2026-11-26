/** US session helpers for extended-hours (pre / after) watchlist column. */

function easternParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
  return {
    dow: dayMap[wd] ?? 0,
    minutes: hour * 60 + minute,
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** NYSE/Nasdaq full-day closures (ET calendar dates). */
const NYSE_FULL_CLOSE = new Map([
  ['2026-01-01', 'New Year\'s Day'],
  ['2026-01-19', 'Martin Luther King Jr. Day'],
  ['2026-02-16', 'Presidents Day'],
  ['2026-04-03', 'Good Friday'],
  ['2026-05-25', 'Memorial Day'],
  ['2026-06-19', 'Juneteenth'],
  ['2026-07-03', 'Independence Day (observed)'],
  ['2026-09-07', 'Labor Day'],
  ['2026-11-26', 'Thanksgiving'],
  ['2026-12-25', 'Christmas'],
]);

/** Early close at 13:00 ET (minutes from midnight). */
const NYSE_EARLY_CLOSE = new Map([
  ['2026-11-27', 'Day after Thanksgiving'],
  ['2026-12-24', 'Christmas Eve'],
]);

const SESSION_OPEN = 9 * 60 + 30;
const SESSION_CLOSE_REGULAR = 16 * 60;
const SESSION_CLOSE_EARLY = 13 * 60;

export function easternYmd(now = new Date()) {
  return easternParts(now).ymd;
}

/** @returns {{ fullClose: boolean, earlyClose: boolean, holidayName: string|null, closeMinutes: number }} */
export function nyseSessionCalendar(now = new Date()) {
  const { ymd } = easternParts(now);
  const fullName = NYSE_FULL_CLOSE.get(ymd);
  if (fullName) {
    return {
      fullClose: true,
      earlyClose: false,
      holidayName: fullName,
      closeMinutes: SESSION_CLOSE_REGULAR,
    };
  }
  const earlyName = NYSE_EARLY_CLOSE.get(ymd);
  if (earlyName) {
    return {
      fullClose: false,
      earlyClose: true,
      holidayName: earlyName,
      closeMinutes: SESSION_CLOSE_EARLY,
    };
  }
  return {
    fullClose: false,
    earlyClose: false,
    holidayName: null,
    closeMinutes: SESSION_CLOSE_REGULAR,
  };
}

export function isNyseFullMarketHoliday(now = new Date()) {
  return nyseSessionCalendar(now).fullClose;
}

export function nyseHolidayLabel(now = new Date()) {
  const cal = nyseSessionCalendar(now);
  return cal.fullClose || cal.earlyClose ? cal.holidayName : null;
}

/** US listed equities regular session (NYSE/Nasdaq), Mon–Fri 9:30–close ET (early close aware). */
export function isUsRegularSessionByClock(now = new Date()) {
  const { dow, minutes } = easternParts(now);
  if (dow === 0 || dow === 6) return false;
  const cal = nyseSessionCalendar(now);
  if (cal.fullClose) return false;
  return minutes >= SESSION_OPEN && minutes < cal.closeMinutes;
}

/**
 * Pre / post / regular / holiday from US equity calendar (no quote metadata).
 * @returns {'pre'|'post'|'regular'|'holiday'}
 */
export function closedExtendedModeByClock(now = new Date()) {
  const { dow, minutes } = easternParts(now);
  if (dow === 0 || dow === 6) return 'post';
  const cal = nyseSessionCalendar(now);
  if (cal.fullClose) return 'holiday';
  const close = cal.closeMinutes;
  if (minutes < SESSION_OPEN) return 'pre';
  if (minutes >= close) return 'post';
  return 'regular';
}

export function normalizeMarketState(state) {
  const s = String(state || '').trim().toUpperCase();
  if (s === 'PREPRE') return 'PRE';
  if (s === 'POSTPOST') return 'POST';
  return s || null;
}

/** When Yahoo reports CLOSED, pick pre vs after vs holiday from US equity calendar. */
export function resolveUsExtendedColumnMode(itemsOrState, now = new Date()) {
  const clockRegular = isUsRegularSessionByClock(now);
  const clockExt = closedExtendedModeByClock(now);

  if (clockExt === 'holiday') return 'holiday';

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
    return clockExt;
  }

  return clockRegular ? 'regular' : clockExt;
}

export function extendedColumnLabel(mode) {
  if (mode === 'holiday') return 'Market closed';
  return mode === 'post' ? 'After hours' : 'Pre-market';
}

/** Subtitle under the extended-hours watchlist column header. */
export function extendedColumnBaselineSubtitle(mode) {
  if (mode === 'post') return 'vs at close';
  if (mode === 'pre') return 'vs at close';
  if (mode === 'holiday') return 'NYSE closed';
  return '';
}

/** Subtitle under the Regular Market watchlist column header. */
export function regularMarketColumnSubtitle(extendedMode) {
  if (extendedMode === 'regular') return 'live · vs Previous Close';
  if (extendedMode === 'pre') return '— regular session closed';
  if (extendedMode === 'holiday') return 'market holiday · last close';
  return 'session close · vs Previous Close';
}

/** Tooltip for pre/post watchlist column headers and cells. */
export function extendedColumnTitle(mode) {
  if (mode === 'regular') {
    return 'Pre-market and after hours are hidden during the US regular session';
  }
  if (mode === 'holiday') {
    const name = nyseHolidayLabel() ?? 'NYSE holiday';
    return `US equity markets closed · ${name}`;
  }
  if (mode === 'post') {
    return 'After hours price vs at close';
  }
  return 'Pre-market price vs at close';
}

export function regularMarketColumnTitle(extendedMode) {
  if (extendedMode === 'regular') {
    return 'Regular Market live price (regularMarketPrice / current) · day change vs Previous Close';
  }
  if (extendedMode === 'pre') {
    return 'Pre-market: regular session is not open — prior close is only in the Previous Close column';
  }
  if (extendedMode === 'holiday') {
    return 'Market holiday — showing last regular session close vs prior close';
  }
  return 'Regular Market session close · day change vs Previous Close';
}

export function previousCloseColumnTitle() {
  return 'Close of the prior trading session';
}

/** Watchlist: only two price columns — Previous Close + (Pre | After | Live). */
export function watchlistTwoPriceColumns(extendedMode) {
  if (extendedMode === 'regular') {
    return { showRegularMarket: true, showExtended: false };
  }
  if (extendedMode === 'holiday') {
    return { showRegularMarket: true, showExtended: false };
  }
  return { showRegularMarket: false, showExtended: true };
}

/** Second watchlist price column — label follows US session (PRE / After / Live). */
export function watchlistSecondColumnLabel(extendedMode) {
  if (extendedMode === 'regular') {
    return {
      label: 'Live',
      subtitle: 'vs Previous Close',
      title: regularMarketColumnTitle('regular'),
    };
  }
  if (extendedMode === 'holiday') {
    const hol = nyseHolidayLabel() ?? 'Holiday';
    return {
      label: 'Last close',
      subtitle: 'vs Previous Close',
      title: `Market closed · ${hol}`,
    };
  }
  if (extendedMode === 'post') {
    return {
      label: 'After hours',
      subtitle: extendedColumnBaselineSubtitle('post'),
      title: extendedColumnTitle('post'),
    };
  }
  return {
    label: 'Pre-market',
    subtitle: extendedColumnBaselineSubtitle('pre'),
    title: extendedColumnTitle('pre'),
  };
}

/** Heatmap header badge + helper copy for the active session. */
export function heatmapSessionMeta(mode, now = new Date()) {
  if (mode === 'holiday') {
    const hol = nyseHolidayLabel(now) ?? 'Market holiday';
    return {
      badge: 'CLOSED',
      title: `Market closed · ${hol}`,
      subtitle: `NYSE closed (${hol})`,
      badgeClass:
        'bg-slate-800/90 text-slate-300 border-slate-500/60 ring-1 ring-slate-500/25',
    };
  }
  if (mode === 'regular') {
    return {
      badge: 'LIVE',
      title: 'Market heatmap · Live',
      subtitle: 'Regular session vs previous close',
      badgeClass:
        'bg-emerald-950/80 text-emerald-300 border-emerald-600/50 ring-1 ring-emerald-500/30',
    };
  }
  if (mode === 'pre') {
    return {
      badge: 'PRE',
      title: 'Market heatmap · Pre-market',
      subtitle: 'Pre-market vs at close',
      badgeClass:
        'bg-amber-950/80 text-amber-200 border-amber-600/50 ring-1 ring-amber-500/30',
    };
  }
  return {
    badge: 'AFTER',
    title: 'Market heatmap · After hours',
    subtitle: 'After hours vs at close',
    badgeClass:
      'bg-violet-950/80 text-violet-200 border-violet-600/50 ring-1 ring-violet-500/30',
  };
}

/** Single pill copy: “US session now · …” */
export function usSessionNowPillMeta(extendedMode, now = new Date()) {
  if (extendedMode === 'holiday') {
    const hol = nyseHolidayLabel(now) ?? 'Holiday';
    return {
      prefix: 'US session now',
      badge: 'CLOSED',
      detail: hol,
      badgeClass:
        'bg-slate-800/90 text-slate-300 border-slate-500/60 ring-1 ring-slate-500/25',
      title: `Markets closed · ${hol}`,
    };
  }
  const meta = heatmapSessionMeta(extendedMode, now);
  return {
    prefix: 'US session now',
    badge: meta.badge,
    detail: null,
    badgeClass: meta.badgeClass,
    title: meta.subtitle,
  };
}

export function isExtendedColumnMuted(mode) {
  return mode === 'regular' || mode === 'holiday';
}

export function isRegularMarketLive(marketState) {
  return resolveUsExtendedColumnMode(marketState) === 'regular';
}

/** @deprecated use resolveUsExtendedColumnMode + isExtendedColumnMuted */
export function shouldMutePreMarketColumn(itemsOrState) {
  return isExtendedColumnMuted(resolveUsExtendedColumnMode(itemsOrState));
}