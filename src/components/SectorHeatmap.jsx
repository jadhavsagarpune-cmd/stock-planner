import { ALL_WATCHLIST_ENTRIES } from '../data/watchlist';
import { formatChangePct, pickHeatmapChangePct } from '../lib/stockFormat';
import { heatmapSessionMeta } from '../lib/stockMarketSession';

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

/**
 * Compact grid of all watchlist symbols clustered by session % change band.
 * @param {{ items: object[], sessionMode: 'regular' | 'pre' | 'post' }} props
 */
export default function SectorHeatmap({ items, sessionMode = 'regular' }) {
  const session = heatmapSessionMeta(sessionMode);
  const bySym = new Map();
  for (const it of items) {
    bySym.set(String(it.name || '').trim().toUpperCase(), it);
  }

  if (!items.length) return null;

  const rows = ALL_WATCHLIST_ENTRIES.map(([label, symbol]) => {
    const sym = String(symbol).trim().toUpperCase();
    const it = bySym.get(sym);
    const pct = pickHeatmapChangePct(it, sessionMode);
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
    <div className="rounded-xl border border-slate-700/90 bg-slate-900/50 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            {session.title}
          </h2>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wider ${session.badgeClass}`}
          >
            {session.badge}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 text-right max-w-[16rem] leading-snug">
          {session.subtitle}
        </span>
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
                {band.tiles.map(({ label, sym, it, pct }) => {
                  const title = `${label} · ${formatChangePct(pct) ?? '—'} (${session.badge})`;
                  return (
                    <span
                      key={sym}
                      title={title}
                      className={`inline-flex flex-col items-center justify-center min-w-[2.75rem] px-1 py-1 rounded border text-[9px] font-mono tabular-nums ${heatColor(pct)}`}
                    >
                      <span className="text-slate-200 font-semibold">
                        {sym.replace('.KS', '')}
                      </span>
                      <span className="text-slate-400 scale-90">
                        {it?.status === 'done' ? formatChangePct(pct) ?? '—' : '…'}
                      </span>
                    </span>
                  );
                })}
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
              {noData.map(({ label, sym, pct }) => (
                <span
                  key={sym}
                  title={`${label} · ${formatChangePct(pct) ?? '—'}`}
                  className={`inline-flex flex-col items-center justify-center min-w-[2.75rem] px-1 py-1 rounded border text-[9px] font-mono tabular-nums ${heatColor(pct)}`}
                >
                  <span className="text-slate-200 font-semibold">{sym.replace('.KS', '')}</span>
                  <span className="text-slate-400 scale-90">…</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
