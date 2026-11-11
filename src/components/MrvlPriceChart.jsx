import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarvellMarker from './MarvellMarker';
import {
  DEFAULT_MRVL_CHART_RANGE_ID,
  fetchYahooChartCloses,
  mergeLivePriceIntoBars,
  MRVL_CHART_RANGES,
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
  svgPointToClient,
} from '../lib/mrvlChartGeometry';
import StockPriceChangeLines from './StockPriceChangeLines';
import MarketStatusChip from './MarketStatusChip';
import {
  activeSessionPriceLabel,
  pickActiveSessionPrice,
  pickSessionDayChange,
  resolveActiveSession,
} from '../lib/sessionQuote';

const CHART_W = 640;
const CHART_H = 160;
const PAD = { t: 8, r: 8, b: 22, l: 8 };
const INTRADAY_CHART_POLL_MS = 60_000;

function isIntradayChartInterval(interval) {
  return interval === '1m' || interval === '5m' || interval === '15m' || interval === '30m';
}

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

function chartPriceBasisLine(mrvl) {
  const live = mrvl ? pickActiveSessionPrice(mrvl) : null;
  return live != null
    ? 'Chart last bar uses live quote when polling.'
    : 'Chart from Yahoo closes; intraday ranges refresh about every 60s.';
}

export default function MrvlPriceChart({ mrvl, mrvlErr, fxRate, mrvlInrHint, extMuted, extLabel, mrvlExt, mrvlExtInrHint }) {
  const [rangeId, setRangeId] = useState(DEFAULT_MRVL_CHART_RANGE_ID);
  const [bars, setBars] = useState([]);
  const [chartErr, setChartErr] = useState('');
  const [chartLoading, setChartLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);
  const chartWrapRef = useRef(null);

  const rangeSpec = useMemo(
    () =>
      MRVL_CHART_RANGES.find((r) => r.id === rangeId)
      ?? MRVL_CHART_RANGES.find((r) => r.id === DEFAULT_MRVL_CHART_RANGE_ID)
      ?? MRVL_CHART_RANGES[0],
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
    if (!isIntradayChartInterval(rangeSpec.interval)) return undefined;
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

  const updateHoverFromClient = useCallback(
    (clientX, clientY) => {
      const idx = nearestBarIndexFromPointer(
        clientX,
        svgRef.current,
        pointerGeom,
        clientY,
      );
      setHoverIndex(idx);
    },
    [pointerGeom],
  );

  const onChartPointerMove = useCallback(
    (e) => {
      updateHoverFromClient(e.clientX, e.clientY);
    },
    [updateHoverFromClient],
  );

  const onChartPointerLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const onChartTouchMove = useCallback(
    (e) => {
      const t = e.touches[0];
      if (t) updateHoverFromClient(t.clientX, t.clientY);
    },
    [updateHoverFromClient],
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
  const tooltipLeftPct = useMemo(() => {
    if (hoverX == null || hoverY == null) return 50;
    const svg = svgRef.current;
    const wrap = chartWrapRef.current;
    const client = svg ? svgPointToClient(hoverX, hoverY, svg) : null;
    const wrapRect = wrap?.getBoundingClientRect?.();
    if (client && wrapRect?.width) {
      return Math.min(92, Math.max(8, ((client.x - wrapRect.left) / wrapRect.width) * 100));
    }
    return Math.min(92, Math.max(8, (hoverX / CHART_W) * 100));
  }, [hoverX, hoverY]);

  const livePrice = mrvl ? pickActiveSessionPrice(mrvl) : null;
  const sessionDay = mrvl ? pickSessionDayChange(mrvl) : null;
  const displayPrice = livePrice ?? mrvl?.regular_price ?? chartLast;
  const currency = mrvl?.currency ?? 'USD';
  const headlineLabel = mrvl ? activeSessionPriceLabel(mrvl) : 'Price';
  const rangeChipLabel = rangeSpec.label;
  const basisLine = chartPriceBasisLine(mrvl);
  const headlineTone =
    sessionDay?.pct != null ? changeColorClass(sessionDay.pct) : 'text-amber-50';
  const activeSession = mrvl ? resolveActiveSession(mrvl) : 'closed';
  const showExtColumn =
    !extMuted && mrvlExt?.price != null && activeSession === 'regular';

  return (
    <section className={`mb-4 rounded-xl border p-3 sm:p-4 ${MARVELL_HERO_PANEL}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wide text-amber-300/90 font-semibold min-w-0">
          <MarvellMarker size={14} />
          <span className="truncate">Marvell Technology</span>
          <span className={`${MARVELL_TICKER_CHIP} shrink-0`}>MRVL</span>
          {mrvl ? <MarketStatusChip quote={mrvl} className="shrink-0" /> : null}
        </div>
        <div
          className="flex gap-1 w-full sm:w-auto sm:justify-end overflow-x-auto overflow-y-hidden flex-nowrap pb-0.5 -mx-0.5 px-0.5 snap-x snap-mandatory scrollbar-thin"
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
                className={`shrink-0 snap-start text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border tabular-nums transition-colors ${
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
              <span
                className={`font-mono text-2xl sm:text-3xl font-semibold tabular-nums block leading-tight ${headlineTone}`}
              >
                {formatStockPrice(displayPrice, currency)}
              </span>
              {mrvlInrHint ? (
                <span className="text-[11px] sm:text-xs font-normal text-violet-300/90 block mt-0.5 tabular-nums">
                  {mrvlInrHint}
                </span>
              ) : null}
              {sessionDay ? (
                <div className="mt-1.5 min-w-0">
                  <StockPriceChangeLines
                    quote={mrvl}
                    pct={sessionDay.pct}
                    changeAbs={sessionDay.abs}
                    currency={currency}
                    fxRate={fxRate}
                    showInrChange
                    className="!items-start !text-[11px] sm:!text-xs"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">{sessionDay.referenceLabel}</span>
                </div>
              ) : null}
            </div>
            {showExtColumn && (
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
          {periodPct != null && chartBars.length > 1 && (
            <p className="text-[11px] sm:text-xs tabular-nums leading-snug">
              <span className="text-slate-500">{rangeChipLabel} range · vs range open</span>{' '}
              <span className={`font-mono font-semibold ${changeColorClass(periodPct)}`}>
                {formatSignedChangeAmount(periodAbs, currency)} ({formatChangePct(periodPct)})
              </span>
            </p>
          )}
          <p className="text-[10px] text-slate-500 leading-snug">{basisLine}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500 mb-2">Loading MRVL…</p>
      )}

      <div
        ref={chartWrapRef}
        className="relative rounded-lg bg-slate-950/50 border border-amber-500/20 overflow-hidden"
      >
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
