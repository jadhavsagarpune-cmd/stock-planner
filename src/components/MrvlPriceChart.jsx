import { useCallback, useEffect, useMemo, useState } from 'react';
import MarvellMarker from './MarvellMarker';
import {
  DEFAULT_MRVL_CHART_RANGE_ID,
  fetchYahooChartCloses,
  MRVL_CHART_RANGES,
} from '../lib/historicalQuotes';
import { MARVELL_HERO_PANEL, MARVELL_TICKER_CHIP, MARVELL_TICKER } from '../lib/marvellBrand';
import {
  changeColorClass,
  formatChangePct,
  formatSignedChangeAmount,
  formatStockPrice,
} from '../lib/stockFormat';
import StockPriceChangeLines from './StockPriceChangeLines';

const CHART_W = 640;
const CHART_H = 160;
const PAD = { t: 8, r: 8, b: 22, l: 8 };

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

function buildPath(bars, plotW, plotH, minY, maxY) {
  if (!bars.length || maxY <= minY) return '';
  const span = maxY - minY || 1;
  const n = bars.length;
  const pts = bars.map((b, i) => {
    const x = PAD.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const y = PAD.t + plotH - ((b.close - minY) / span) * plotH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M ${pts.join(' L ')}`;
}

function buildArea(bars, plotW, plotH, minY, maxY) {
  const line = buildPath(bars, plotW, plotH, minY, maxY);
  if (!line || !bars.length) return '';
  const n = bars.length;
  const x0 = PAD.l;
  const x1 = PAD.l + (n <= 1 ? plotW / 2 : plotW);
  const yBase = PAD.t + plotH;
  return `${line} L ${x1.toFixed(2)},${yBase} L ${x0.toFixed(2)},${yBase} Z`;
}

export default function MrvlPriceChart({ mrvl, mrvlErr, fxRate, mrvlInrHint, extMuted, extLabel, mrvlExt, mrvlExtInrHint }) {
  const [rangeId, setRangeId] = useState(DEFAULT_MRVL_CHART_RANGE_ID);
  const [bars, setBars] = useState([]);
  const [chartErr, setChartErr] = useState('');
  const [chartLoading, setChartLoading] = useState(true);

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

  const { pct: periodPct, abs: periodAbs, last: chartLast } = useMemo(() => periodChange(bars), [bars]);
  const up = periodPct != null && periodPct >= 0;
  const stroke = up ? '#34d399' : '#f87171';
  const fillId = up ? 'mrvl-chart-up' : 'mrvl-chart-down';

  const plotW = CHART_W - PAD.l - PAD.r;
  const plotH = CHART_H - PAD.t - PAD.b;
  const closes = bars.map((b) => b.close);
  const minY = closes.length ? Math.min(...closes) : 0;
  const maxY = closes.length ? Math.max(...closes) : 1;
  const padY = (maxY - minY) * 0.06 || 0.5;
  const yMin = minY - padY;
  const yMax = maxY + padY;

  const linePath = buildPath(bars, plotW, plotH, yMin, yMax);
  const areaPath = buildArea(bars, plotW, plotH, yMin, yMax);

  const displayPrice = mrvl?.regular_price ?? chartLast;
  const currency = mrvl?.currency ?? 'USD';

  return (
    <section className={`mb-4 rounded-xl border p-3 sm:p-4 ${MARVELL_HERO_PANEL}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-300/90 font-semibold">
          <MarvellMarker size={14} />
          <span>Marvell Technology</span>
          <span className={MARVELL_TICKER_CHIP}>MRVL</span>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="MRVL chart range">
          {MRVL_CHART_RANGES.map((r) => {
            const active = r.id === rangeId;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRangeId(r.id)}
                className={`text-[11px] px-2 py-1 rounded-md border tabular-nums transition-colors ${
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
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-3">
          <div>
            <span className="text-xs text-slate-500 block">Current</span>
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-amber-50">
                {formatStockPrice(displayPrice, currency)}
                {mrvlInrHint && (
                  <span className="text-sm font-normal text-violet-300/90 ml-1.5">({mrvlInrHint})</span>
                )}
              </span>
              {mrvl ? (
                <StockPriceChangeLines
                  quote={mrvl}
                  pct={mrvl.regular_change_pct}
                  currency={currency}
                  fxRate={fxRate}
                  showInrChange
                  className="!items-start"
                />
              ) : null}
            </div>
          </div>
          {!extMuted && mrvlExt?.price != null && (
            <div>
              <span className="text-xs text-slate-500 block">{extLabel}</span>
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-mono text-violet-200 font-semibold tabular-nums">
                  {formatStockPrice(mrvlExt.price, currency)}
                  {mrvlExtInrHint && (
                    <span className="text-sm font-normal text-violet-300/80 ml-1.5">({mrvlExtInrHint})</span>
                  )}
                </span>
                <StockPriceChangeLines
                  pct={mrvlExt.pct}
                  changeAbs={mrvlExt.abs}
                  currency={currency}
                  fxRate={fxRate}
                  showInrChange
                  className="!items-start"
                />
              </div>
            </div>
          )}
          {periodPct != null && bars.length > 1 && (
            <div className="sm:ml-auto">
              <span className="text-xs text-slate-500 block">{rangeId} change</span>
              <p className={`font-mono text-sm tabular-nums ${changeColorClass(periodPct)}`}>
                {formatSignedChangeAmount(periodAbs, currency)}{' '}
                <span className="text-xs opacity-90">({formatChangePct(periodPct)})</span>
              </p>
            </div>
          )}
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
        {!chartErr && bars.length > 0 && (
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full h-[140px] sm:h-[160px] block"
            role="img"
            aria-label={`MRVL price chart, ${rangeId}`}
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
            {areaPath && <path d={areaPath} fill={`url(#${fillId})`} />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        )}
      </div>
    </section>
  );
}
