import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarvellMarker from './MarvellMarker';
import {
  DEFAULT_MRVL_CHART_RANGE_ID,
  fetchYahooChartCloses,
  mergeLivePriceIntoBars,
  MRVL_CHART_RANGES,
  pickLiveChartPrice,
} from '../lib/historicalQuotes';
import { MARVELL_HERO_PANEL, MARVELL_TICKER_CHIP, MARVELL_TICKER } from '../lib/marvellBrand';
import {
  changeColorClass,
  formatChangePct,
  formatSignedChangeAmount,
  formatStockPrice,
} from '../lib/stockFormat';
import {
  barIndexToSvgX,
  closeToSvgY,
  formatChartBarTime,
  nearestBarIndexFromPointer,
  pctFromRangeStart,
} from '../lib/mrvlChartGeometry';
import StockPriceChangeLines from './StockPriceChangeLines';

const CHART_W = 640;
const CHART_H = 160;
const PAD = { t: 8, r: 8, b: 22, l: 8 };
const INTRADAY_CHART_POLL_MS = 60_000;

function periodChange(bars) {
  if (!bars?.length) return { pct: null, abs: null, first: null, last: null };
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (first == null || last == null || first === 0) {
    return { pct: null, abs: null, first, last };
  }
  const pct = ((last - first) / first) * 100;
  return { pct, abs: last - first, first, last };
}

function buildPath(bars, plotW, plotH, yMin, yMax) {
  if (!bars.length || yMax <= yMin) return '';
  const n = bars.length;
  const pts = bars.map((b, i) => {
    const x = barIndexToSvgX(i, n, PAD.l, plotW);
    const y = closeToSvgY(b.close, PAD.t, plotH, yMin, yMax);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${pts.join(' L ')}`;
}

function buildArea(bars, plotW, plotH, yMin, yMax) {
  const line = buildPath(bars, plotW, plotH, yMin, yMax);
  if (!line || !bars.length) return '';
  const n = bars.length;
  const x0 = PAD.l;
  const x1 = barIndexToSvgX(n - 1, n, PAD.l, plotW);
  const yBase = PAD.t + plotH;
  return `${line} L ${x1.toFixed(2)},${yBase} L ${x0.toFixed(2)},${yBase} Z`;
}

function normalizeMarketState(state) {
  const s = String(state || '').trim().toUpperCase();
  if (s === 'PREPRE') return 'PRE';
  if (s === 'POSTPOST') return 'POST';
  return s;
}

/** User-facing label for the headline price (live poll vs session last). */
function mrvlHeadlinePriceLabel(mrvl, livePrice) {
  if (!mrvl) return 'Price';
  const reg = mrvl.regular_price;
  const state = normalizeMarketState(mrvl.market_state);
  const live =
    livePrice != null
      ? livePrice
      : pickLiveChartPrice(mrvl);
  const differsFromReg =
    live != null && reg != null && Math.abs(live - reg) >= 0.005;
  if (differsFromReg) {
    if (state === 'PRE') return 'Live · pre-market';
    if (state === 'POST' || state === 'CLOSED') return 'Live · after-hours';
    return 'Live price';
  }
  if (reg != null) return 'Last · regular session';
  return 'Last · chart close';
}

function chartPriceBasisLine(mrvl, rangeLabel, rangeStartClose, chartEndClose) {
  const live = mrvl ? pickLiveChartPrice(mrvl) : null;
  const mergeHint =
    live != null
      ? 'live quote merged into chart close'
      : 'Yahoo chart close (poll every 60s on intraday ranges)';
  const startStr =
    rangeStartClose != null ? formatStockPrice(rangeStartClose, mrvl?.currency ?? 'USD') : '—';
  const endStr =
    chartEndClose != null ? formatStockPrice(chartEndClose, mrvl?.currency ?? 'USD') : '—';
  return `Calculations: day change vs prior close · range % vs ${rangeLabel} start (${startStr} → ${endStr}) · chart uses ${mergeHint}`;
}

export default function MrvlPriceChart({ mrvl, mrvlErr, fxRate, mrvlInrHint, extMuted, extLabel, mrvlExt, mrvlExtInrHint }) {
  const [rangeId, setRangeId] = useState(DEFAULT_MRVL_CHART_RANGE_ID);
  const [bars, setBars] = useState([]);
  const [chartErr, setChartErr] = useState('');
  const [chartLoading, setChartLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  const rangeSpec = useMemo(
    () => MRVL_CHART_RANGES.find((r) => r.id === rangeId) ?? MRVL_CHART_RANGES[2],
    [rangeId],
  );

  const loadChart = useCallback(async (signal) => {
    setChartLoading(true);
    setChartErr('');
    try {
      const data = await fetchYahooChartCloses(MARVELL_TICKER, {
        range: rangeSpec.range,
        interval: rangeSpec.interval,
        signal,
      });
      setBars(data);
      if (!data.length) setChartErr('No chart points');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setChartErr(e.message || 'Chart failed');
      setBars([]);
    } finally {
      setChartLoading(false);
    }
  }, [rangeSpec]);

  useEffect(() => {
    const ac = new AbortController();
    void loadChart(ac.signal);
    return () => ac.abort();
  }, [loadChart]);

  useEffect(() => {
    if (rangeSpec.interval !== '15m' && rangeSpec.interval !== '30m') return undefined;
    const id = window.setInterval(() => {
      const ac = new AbortController();
      void loadChart(ac.signal);
    }, INTRADAY_CHART_POLL_MS);
    return () => window.clearInterval(id);
  }, [loadChart, rangeSpec.interval]);

  const chartBars = useMemo(
    () => mergeLivePriceIntoBars(bars, mrvl, { interval: rangeSpec.interval }),
    [bars, mrvl, rangeSpec.interval],
  );

  const { pct: periodPct, abs: periodAbs, last: chartLast } = useMemo(
    () => periodChange(chartBars),
    [chartBars],
  );
  const up = periodPct != null && periodPct >= 0;
  const stroke = up ? '#34d399' : '#f87171';
  const fillId = up ? 'mrvl-chart-up' : 'mrvl-chart-down';

  const plotW = CHART_W - PAD.l - PAD.r;
  const plotH = CHART_H - PAD.t - PAD.b;
  const closes = chartBars.map((b) => b.close);
  const minY = closes.length ? Math.min(...closes) : 0;
  const maxY = closes.length ? Math.max(...closes) : 1;
  const padY = (maxY - minY) * 0.06 || 0.5;
  const yMin = minY - padY;
  const yMax = maxY + padY;

  const linePath = buildPath(chartBars, plotW, plotH, yMin, yMax);
  const areaPath = buildArea(chartBars, plotW, plotH, yMin, yMax);

  const rangeStartClose = chartBars[0]?.close ?? null;

  const pointerGeom = useMemo(
    () => ({ chartW: CHART_W, padL: PAD.l, plotW, barCount: chartBars.length }),
    [plotW, chartBars.length],
  );

  const updateHoverFromClientX = useCallback(
    (clientX) => {
      const idx = nearestBarIndexFromPointer(clientX, svgRef.current, pointerGeom);
      setHoverIndex(idx);
    },
    [pointerGeom],
  );

  const onChartPointerMove = useCallback(
    (e) => {
      updateHoverFromClientX(e.clientX);
    },
    [updateHoverFromClientX],
  );

  const onChartPointerLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const onChartTouchMove = useCallback(
    (e) => {
      const t = e.touches[0];
      if (t) updateHoverFromClientX(t.clientX);
    },
    [updateHoverFromClientX],
  );

  useEffect(() => {
    setHoverIndex(null);
  }, [rangeId, chartBars.length]);

  const hoveredBar = hoverIndex != null ? chartBars[hoverIndex] : null;
  const hoverX =
    hoverIndex != null ? barIndexToSvgX(hoverIndex, chartBars.length, PAD.l, plotW) : null;
  const hoverY =
    hoveredBar != null ? closeToSvgY(hoveredBar.close, PAD.t, plotH, yMin, yMax) : null;
  const hoverRangePct =
    hoveredBar != null ? pctFromRangeStart(hoveredBar.close, rangeStartClose) : null;
  const tooltipLeftPct =
    hoverX != null ? Math.min(92, Math.max(8, (hoverX / CHART_W) * 100)) : 50;

  const livePrice = mrvl ? pickLiveChartPrice(mrvl) : null;
  const displayPrice = livePrice ?? mrvl?.regular_price ?? chartLast;
  const currency = mrvl?.currency ?? 'USD';
  const headlineLabel = mrvlHeadlinePriceLabel(mrvl, livePrice);
  const rangeChipLabel = rangeSpec.label;
  const basisLine = chartPriceBasisLine(mrvl, rangeChipLabel, rangeStartClose, chartLast);

  return (
    <section className={`mb-4 rounded-xl border p-3 sm:p-4 ${MARVELL_HERO_PANEL}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wide text-amber-300/90 font-semibold min-w-0">
          <MarvellMarker size={14} />
          <span className="truncate">Marvell Technology</span>
          <span className={`${MARVELL_TICKER_CHIP} shrink-0`}>MRVL</span>
        </div>
        <div
          className="flex flex-wrap gap-1 w-full sm:w-auto sm:justify-end"
          role="tablist"
          aria-label="MRVL chart range"
        >
          {MRVL_CHART_RANGES.map((r) => {
            const active = r.id === rangeId;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRangeId(r.id)}
                className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border tabular-nums transition-colors ${
                  active
                    ? 'bg-amber-500/25 text-amber-100 border-amber-400/60'
                    : 'bg-slate-950/40 text-slate-400 border-slate-600/50 hover:border-amber-500/35 hover:text-amber-200/90'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {mrvlErr ? (
        <p className="text-sm text-amber-300 mb-2">{mrvlErr}</p>
      ) : displayPrice != null ? (
        <div className="space-y-2 mb-3">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-amber-200/70 font-medium block mb-0.5">
                {headlineLabel}
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-amber-50 block leading-tight">
                {formatStockPrice(displayPrice, currency)}
              </span>
              {mrvlInrHint ? (
                <span className="text-[11px] sm:text-xs font-normal text-violet-300/90 block mt-0.5 tabular-nums">
                  {mrvlInrHint}
                </span>
              ) : null}
              {mrvl ? (
                <div className="mt-1.5 min-w-0">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Day change · vs prior close</span>
                  <StockPriceChangeLines
                    quote={mrvl}
                    pct={mrvl.regular_change_pct}
                    currency={currency}
                    fxRate={fxRate}
                    showInrChange
                    className="!items-start !text-[11px] sm:!text-xs"
                  />
                </div>
              ) : null}
            </div>
            {!extMuted && mrvlExt?.price != null && (
              <div className="min-w-0 min-[420px]:border-l min-[420px]:border-slate-700/50 min-[420px]:pl-3 sm:pl-4">
                <span className="text-[10px] sm:text-xs text-slate-500 block mb-0.5">{extLabel}</span>
                <span className="font-mono text-lg sm:text-xl text-violet-200 font-semibold tabular-nums block">
                  {formatStockPrice(mrvlExt.price, currency)}
                </span>
                {mrvlExtInrHint ? (
                  <span className="text-[11px] sm:text-xs font-normal text-violet-300/80 block mt-0.5 tabular-nums">
                    {mrvlExtInrHint}
                  </span>
                ) : null}
                <div className="mt-1.5">
                  <StockPriceChangeLines
                    pct={mrvlExt.pct}
                    changeAbs={mrvlExt.abs}
                    currency={currency}
                    fxRate={fxRate}
                    showInrChange
                    className="!items-start !text-[11px] sm:!text-xs"
                  />
                </div>
              </div>
            )}
          </div>
          {periodPct != null && chartBars.length > 1 && rangeStartClose != null && chartLast != null && (
            <div className="rounded-lg border border-slate-700/40 bg-slate-950/35 px-2.5 py-2">
              <span className="text-[10px] text-slate-500 block mb-0.5">
                Range change vs {rangeChipLabel} start
              </span>
              <p className="text-[11px] sm:text-xs text-slate-300 tabular-nums font-mono leading-snug break-words">
                {formatStockPrice(rangeStartClose, currency)}
                <span className="text-slate-500 mx-1">→</span>
                {formatStockPrice(chartLast, currency)}
              </p>
              <p className={`font-mono text-sm sm:text-base tabular-nums mt-0.5 ${changeColorClass(periodPct)}`}>
                {formatSignedChangeAmount(periodAbs, currency)}{' '}
                <span className="text-xs opacity-90">({formatChangePct(periodPct)})</span>
              </p>
            </div>
          )}
          <p className="text-[10px] text-slate-500 leading-snug">{basisLine}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500 mb-2">Loading MRVL…</p>
      )}

      <div className="relative rounded-lg bg-slate-950/50 border border-amber-500/20 overflow-hidden">
        {chartLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 z-10 bg-slate-950/40">
            Loading chart…
          </div>
        )}
        {chartErr && !chartLoading && (
          <p className="text-xs text-amber-300/90 px-2 py-6 text-center">{chartErr}</p>
        )}
        {!chartErr && chartBars.length > 0 && (
          <>
            {hoveredBar != null && (
              <div
                className="pointer-events-none absolute z-20 top-1.5 -translate-x-1/2 rounded-md border border-slate-600/80 bg-slate-900/95 px-2 py-1 shadow-lg"
                style={{ left: `${tooltipLeftPct}%` }}
                role="status"
                aria-live="polite"
              >
                <p className="font-mono text-sm font-semibold tabular-nums text-amber-50 whitespace-nowrap">
                  {formatStockPrice(hoveredBar.close, currency)}
                </p>
                <p className="text-[10px] text-slate-400 whitespace-nowrap">
                  {formatChartBarTime(hoveredBar.t, rangeSpec.interval)}
                </p>
                {hoverRangePct != null && (
                  <p
                    className={`text-[10px] tabular-nums whitespace-nowrap ${changeColorClass(hoverRangePct)}`}
                  >
                    {formatChangePct(hoverRangePct)} vs range start
                  </p>
                )}
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full h-[140px] sm:h-[160px] block touch-none cursor-crosshair"
              role="img"
              aria-label={`MRVL price chart, ${rangeId}`}
              onMouseMove={onChartPointerMove}
              onMouseLeave={onChartPointerLeave}
              onTouchStart={onChartTouchMove}
              onTouchMove={onChartTouchMove}
              onTouchEnd={onChartPointerLeave}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line
                x1={PAD.l}
                y1={PAD.t + plotH}
                x2={CHART_W - PAD.r}
                y2={PAD.t + plotH}
                stroke="rgb(51 65 85 / 0.6)"
                strokeWidth="1"
              />
              {areaPath && <path d={areaPath} fill={`url(#${fillId})`} pointerEvents="none" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )}
              {hoverX != null && hoverY != null && (
                <g pointerEvents="none" aria-hidden>
                  <line
                    x1={hoverX}
                    y1={PAD.t}
                    x2={hoverX}
                    y2={PAD.t + plotH}
                    stroke="rgb(148 163 184 / 0.55)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={PAD.l}
                    y1={hoverY}
                    x2={CHART_W - PAD.r}
                    y2={hoverY}
                    stroke="rgb(148 163 184 / 0.35)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                  <circle
                    cx={hoverX}
                    cy={hoverY}
                    r="4"
                    fill={stroke}
                    stroke="rgb(15 23 42)"
                    strokeWidth="2"
                  />
                </g>
              )}
              <rect
                x={PAD.l}
                y={PAD.t}
                width={plotW}
                height={plotH}
                fill="transparent"
                aria-hidden
              />
            </svg>
          </>
        )}
      </div>
    </section>
  );
}
