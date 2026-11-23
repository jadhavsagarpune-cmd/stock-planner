/** Yahoo-style US Eastern time label (e.g. 7:35AM EST). */
export function formatUsMarketTime(unixSeconds, { suffix = ' EST' } = {}) {
  if (unixSeconds == null) return null;
  const ms = Number(unixSeconds);
  if (!Number.isFinite(ms)) return null;
  const ts = ms < 1e12 ? ms * 1000 : ms;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(new Date(ts));
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() ?? '';
    if (!hour) return null;
    return `${hour}:${minute ?? '00'}${dayPeriod}${suffix}`;
  } catch {
    return null;
  }
}

/** Regular session close row on Yahoo uses 4:00PM EST when no timestamp. */
export function formatAtCloseTime(unixSeconds) {
  return formatUsMarketTime(unixSeconds) ?? '4:00PM EST';
}