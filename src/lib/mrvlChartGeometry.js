const US_TZ = 'America/New_York';

/** SVG x for bar index along the plot width (even spacing). */
export function barIndexToSvgX(index, barCount, padL, plotW) {
  if (barCount <= 0) return padL;
  if (barCount <= 1) return padL + plotW / 2;
  const i = Math.max(0, Math.min(barCount - 1, index));
  return padL + (i / (barCount - 1)) * plotW;
}

export function closeToSvgY(close, padT, plotH, yMin, yMax) {
  const span = yMax - yMin || 1;
  return padT + plotH - ((close - yMin) / span) * plotH;
}

/** Map pointer x (viewport) → nearest bar index; null if outside plot. */
export function nearestBarIndexFromPointer(
  clientX,
  svgElement,
  { chartW, padL, plotW, barCount },
) {
  if (!svgElement || barCount < 1) return null;
  const rect = svgElement.getBoundingClientRect();
  if (!rect.width) return null;
  const frac = (clientX - rect.left) / rect.width;
  const svgX = frac * chartW;
  const plotX = svgX - padL;
  if (plotX < 0 || plotX > plotW) return null;
  if (barCount <= 1) return 0;
  const raw = (plotX / plotW) * (barCount - 1);
  return Math.max(0, Math.min(barCount - 1, Math.round(raw)));
}

export function formatChartBarTime(ms, interval) {
  const daily = interval === '1d' || interval === '1wk';
  const d = new Date(ms);
  if (daily) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: US_TZ,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: US_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function pctFromRangeStart(close, rangeStartClose) {
  if (close == null || rangeStartClose == null || rangeStartClose === 0) return null;
  return ((close - rangeStartClose) / rangeStartClose) * 100;
}
