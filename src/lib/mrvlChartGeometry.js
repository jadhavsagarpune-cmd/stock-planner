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

/** Viewport (client) coords → SVG user units (respects viewBox + preserveAspectRatio). */
export function clientPointToSvg(clientX, clientY, svgElement, chartW) {
  if (svgElement?.createSVGPoint && svgElement.getScreenCTM) {
    const pt = svgElement.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const inv = svgElement.getScreenCTM()?.inverse();
    if (inv) return pt.matrixTransform(inv);
  }
  const rect = svgElement?.getBoundingClientRect?.();
  if (!rect?.width || !chartW) return null;
  const viewH = svgElement?.viewBox?.baseVal?.height ?? rect.height;
  const fracX = (clientX - rect.left) / rect.width;
  const fracY = (clientY - rect.top) / rect.height;
  return { x: fracX * chartW, y: fracY * viewH };
}

/** SVG user units → viewport client coords (for tooltip alignment). */
export function svgPointToClient(svgX, svgY, svgElement) {
  if (svgElement?.createSVGPoint && svgElement.getScreenCTM) {
    const pt = svgElement.createSVGPoint();
    pt.x = svgX;
    pt.y = svgY;
    const ctm = svgElement.getScreenCTM();
    if (ctm) return pt.matrixTransform(ctm);
  }
  const rect = svgElement?.getBoundingClientRect?.();
  const chartW = svgElement?.viewBox?.baseVal?.width;
  if (!rect?.width || !chartW) return null;
  const fracX = svgX / chartW;
  return { x: rect.left + fracX * rect.width, y: svgY };
}

/** Map pointer (viewport) → nearest bar index; null if outside plot. */
export function nearestBarIndexFromPointer(
  clientX,
  svgElement,
  { chartW, padL, plotW, barCount },
  clientY = 0,
) {
  if (!svgElement || barCount < 1) return null;
  const svgPt = clientPointToSvg(clientX, clientY, svgElement, chartW);
  if (!svgPt) return null;
  const plotX = svgPt.x - padL;
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
