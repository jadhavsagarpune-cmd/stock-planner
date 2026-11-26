function normalizeUnixMs(unixSeconds) {
  const ms = Number(unixSeconds);
  if (!Number.isFinite(ms)) return null;
  return ms < 1e12 ? ms * 1000 : ms;
}

function easternTzAbbr(epochMs) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).formatToParts(new Date(epochMs));
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
  } catch {
    return 'ET';
  }
}

/** Yahoo-style US Eastern clock (e.g. 4:00:02 PM EST). */
export function formatYahooMarketTimestamp(unixSeconds) {
  const ts = normalizeUnixMs(unixSeconds);
  if (ts == null) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).formatToParts(new Date(ts));
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const second = parts.find((p) => p.type === 'second')?.value ?? '00';
    const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() ?? '';
    if (!hour) return null;
    const tz = easternTzAbbr(ts);
    return `${hour}:${minute}:${second} ${dayPeriod} ${tz}`;
  } catch {
    return null;
  }
}

/** @deprecated use formatYahooMarketTimestamp */
export function formatUsMarketTime(unixSeconds, { suffix = '' } = {}) {
  const label = formatYahooMarketTimestamp(unixSeconds);
  if (!label) return null;
  return suffix ? `${label}${suffix}` : label;
}

export function formatAtCloseTime(unixSeconds) {
  return formatYahooMarketTimestamp(unixSeconds);
}

export function formatAtCloseLabel(unixSeconds) {
  const ts = formatYahooMarketTimestamp(unixSeconds);
  return ts ? `At close: ${ts}` : 'At close: 4:00 PM EST';
}

export function formatAfterHoursLabel(unixSeconds) {
  const ts = formatYahooMarketTimestamp(unixSeconds);
  return ts ? `After hours: ${ts}` : 'After hours';
}

export function formatPreMarketLabel(unixSeconds) {
  const ts = formatYahooMarketTimestamp(unixSeconds);
  return ts ? `Pre-market: ${ts}` : 'Pre-market';
}

export function formatMarketOpenLabel(unixSeconds) {
  const ts = formatYahooMarketTimestamp(unixSeconds);
  return ts ? `Market open · ${ts}` : 'Market open';
}