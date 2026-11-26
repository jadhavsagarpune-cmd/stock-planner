import { ALL_WATCHLIST_ENTRIES } from '../data/watchlist';
import { formatChangePct } from '../lib/stockFormat';
import {
  baselineNeedsDailyHistory,
  formatHeatmapTileTitleForBaseline,
  heatmapBaselineMeta,
  pickHeatmapChangePctForBaseline,
} from '../lib/heatmapBaselines';
import {
  MarketBaselineHistoryRow,
  MarketBaselineSessionRow,
  UsSessionNowPill,
} from './MarketBaselineChips';
import { MARVELL_ACCENT_RING, isMarvellCompany } from '../lib/marvellBrand';
import { MarvellTickerBadge } from './MarvellMarker';

function heatColor(pct) {
  const n = Number(pct);
  if (pct == null || Number.isNaN(n)) return 'bg-slate-800/80 border-slate-700/50';
  if (n >= 10) return 'bg-emerald-500/55 border-emerald-400/50';
  if (n >= 5) return 'bg-emerald-600/50 border-emerald-500/40';
  if (n > 1) return 'bg-emerald-900/50 border-emerald-700/40';
  if (n >= -1 && n <= 1) return 'bg-slate-700/40 border-slate-600/40';
  if (n > -5) return 'bg-red-900/45 border-red-700/40';
  if (n > -10) return 'bg-red-600/45 border-red-500/40';
  return 'bg-red-700/55 border-red-600/50';
}

/** Display order: worst → best (non-overlapping bands). */
const CHANGE_BUCKETS = [
  {
    id: 'bad',
    label: 'Bad',
    subtitle: '≤ −10%',
    match: (n) => n <= -10,
  },
  {
    id: 'strong_down',
    label: 'Strong down',
    subtitle: '−10% to −1%',
    match: (n) => n > -10 && n < -1,
  },
  {
    id: 'flat',
    label: 'Flat',
    subtitle: '0–1%',
    match: (n) => n >= -1 && n <= 1,
  },
  {
    id: 'up',
    label: 'Up',
    subtitle: '1–5%',
    match: (n) => n > 1 && n < 5,
  },
  {
    id: 'strong_up',
    label: 'Strong up',
    subtitle: '5–10%',
    match: (n) => n >= 5 && n < 10,
  },
  {
    id: 'rock_solid',
    label: 'Rock solid',
    subtitle: '≥ 10%',
    match: (n) => n >= 10,
  },
];

function bucketIndex(pct) {
  const n = Number(pct);
  if (pct == null || Number.isNaN(n)) return CHANGE_BUCKETS.length;
  for (let i = 0; i < CHANGE_BUCKETS.length; i += 1) {
    if (CHANGE_BUCKETS[i].match(n)) return i;
  }
  return CHANGE_BUCKETS.length;
}

function googleStockSearchUrl(symbol) {
  const sym = String(symbol || '').trim();
  return `https://www.google.com/search?q=${encodeURIComponent(`${sym} stock`)}`;
}

function HeatmapTile({ sym, label, it, pct, baselineId, daily, clockExtendedMode }) {
  const title = formatHeatmapTileTitleForBaseline(
    label,
    it,
    pct,
    baselineId,
    daily,
    clockExtendedMode,
  );
  const href = googleStockSearchUrl(sym);
  const marvell = isMarvellCompany(sym) || isMarvellCompany(label);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${title} · Search on Google`}
      className={`inline-flex flex-col items-center justify-center min-w-[2.75rem] px-1 py-1 rounded border text-[9px] font-mono tabular-nums no-underline hover:underline cursor-pointer ${heatColor(pct)} ${marvell ? MARVELL_ACCENT_RING : ''}`}
    >
      {marvell ? (
        <MarvellTickerBadge symbol={sym} className="scale-90" />
      ) : (
        <span className="text-slate-200 font-semibold">{sym.replace('.KS', '')}</span>
      )}
      <span className={`scale-90 ${marvell ? 'text-amber-200/80' : 'text-slate-400'}`}>
        {it?.status === 'done'
          ? formatChangePct(pct) ?? '—'
          : it?.status === 'failed'
            ? '—'
            : '…'}
      </span>
    </a>
  );
}

/**
 * Compact grid of all watchlist symbols clustered by % change vs selected baseline.
 * @param {{ items: object[], baselineId: string, onBaselineChange: (id: string) => void, dailyBySymbol: Map }} props
 */
export default function SectorHeatmap({
  items,
  baselineId = 'live',
  onBaselineChange,
  dailyBySymbol = null,
  extendedMode = 'regular',
}) {
  const session = heatmapBaselineMeta(baselineId, extendedMode);
  const needsHistory = baselineNeedsDailyHistory(baselineId);
  const historyReady = !needsHistory || (dailyBySymbol && dailyBySymbol.size > 0);
  const bySym = new Map();
  for (const it of items) {
    bySym.set(String(it.name || '').trim().toUpperCase(), it);
  }

  if (!items.length) return null;

  const rows = ALL_WATCHLIST_ENTRIES.map(([label, symbol]) => {
    const sym = String(symbol).trim().toUpperCase();
    const it = bySym.get(sym);
    const daily = dailyBySymbol?.get(sym) ?? null;
    const pct = pickHeatmapChangePctForBaseline(it, baselineId, daily);
    const n = Number(pct);
    const sortKey = pct == null || Number.isNaN(n) ? 999 : n;
    return { label, sym, it, pct, sortKey, bucket: bucketIndex(pct) };
  });

  const bucketRows = CHANGE_BUCKETS.map((bucket, idx) => ({
    ...bucket,
    tiles: rows
      .filter((r) => r.bucket === idx)
      .sort((a, b) => {
        if (bucket.id === 'bad' || bucket.id === 'strong_down') {
          return a.sortKey - b.sortKey;
        }
        return b.sortKey - a.sortKey;
      }),
  }));

  const noData = rows
    .filter((r) => r.bucket === CHANGE_BUCKETS.length)
    .sort((a, b) => a.sym.localeCompare(b.sym));

  return (
    <section
      id="sector-heatmap"
      aria-label="Market sector heatmap"
      className="rounded-xl border border-slate-700/90 bg-slate-900/50 p-3 sm:p-4"
    >
      <div className="sticky top-0 z-[1] -mx-3 -mt-3 px-3 pt-3 pb-2 mb-2 sm:-mx-4 sm:-mt-4 sm:px-4 sm:pt-4 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/80">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide shrink-0">
              {session.title}
            </h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wider shrink-0 ${session.badgeClass}`}
              title="Selected baseline filter"
            >
              {session.badge}
            </span>
            <UsSessionNowPill clockSession={extendedMode} />
            <MarketBaselineSessionRow
              baselineId={baselineId}
              onBaselineChange={onBaselineChange}
              theme="violet"
              clockSession={extendedMode}
            />
            {needsHistory && !historyReady && (
              <span className="text-[10px] text-amber-400/90 shrink-0">Loading history…</span>
            )}
          </div>
          <MarketBaselineHistoryRow
            baselineId={baselineId}
            onBaselineChange={onBaselineChange}
            theme="violet"
          />
          <p className="text-[10px] text-slate-500 leading-snug">
            {session.subtitle}
            {needsHistory
              ? ' · Daily closes cached locally (IndexedDB); snapshots recorded on each refresh.'
              : ''}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {bucketRows.map((band) => (
          <div key={band.id}>
            <div className="flex items-baseline gap-2 mb-1.5 border-b border-slate-700/60 pb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {band.label}
              </p>
              <span className="text-[10px] text-slate-600">{band.subtitle}</span>
              <span className="text-[10px] text-slate-600 ml-auto tabular-nums">
                {band.tiles.length}
              </span>
            </div>
            {band.tiles.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {band.tiles.map(({ label, sym, it, pct }) => (
                  <HeatmapTile
                    key={sym}
                    sym={sym}
                    label={label}
                    it={it}
                    pct={pct}
                    baselineId={baselineId}
                    daily={dailyBySymbol?.get(sym)}
                    clockExtendedMode={extendedMode}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-600 italic py-0.5">No symbols in this band</p>
            )}
          </div>
        ))}
        {noData.length > 0 && (
          <div>
            <div className="flex items-baseline gap-2 mb-1.5 border-b border-slate-700/60 pb-1">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Pending / no quote
              </p>
              <span className="text-[10px] text-slate-600 ml-auto tabular-nums">
                {noData.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {noData.map(({ label, sym, it, pct }) => (
                <HeatmapTile
                  key={sym}
                  sym={sym}
                  label={label}
                  it={it}
                  pct={pct}
                  baselineId={baselineId}
                  daily={dailyBySymbol?.get(sym)}
                  clockExtendedMode={extendedMode}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
