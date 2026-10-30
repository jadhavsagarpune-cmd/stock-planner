import { ALL_WATCHLIST_ENTRIES } from '../data/watchlist';
import { formatChangePct } from '../lib/stockFormat';

function heatColor(pct) {
  const n = Number(pct);
  if (pct == null || Number.isNaN(n)) return 'bg-slate-800/80 border-slate-700/50';
  if (n >= 2) return 'bg-emerald-600/50 border-emerald-500/40';
  if (n > 0.25) return 'bg-emerald-900/50 border-emerald-700/40';
  if (n <= -2) return 'bg-red-600/45 border-red-500/40';
  if (n < -0.25) return 'bg-red-900/45 border-red-700/40';
  return 'bg-slate-700/40 border-slate-600/40';
}

const CHANGE_BUCKETS = [
  {
    id: 'strong_down',
    label: 'Strong down',
    subtitle: '≤ −2%',
    match: (n) => n <= -2,
  },
  {
    id: 'down',
    label: 'Down',
    subtitle: '−2% to −0.25%',
    match: (n) => n > -2 && n < -0.25,
  },
  {
    id: 'flat',
    label: 'Flat',
    subtitle: '−0.25% to +0.25%',
    match: (n) => n >= -0.25 && n <= 0.25,
  },
  {
    id: 'up',
    label: 'Up',
    subtitle: '+0.25% to +2%',
    match: (n) => n > 0.25 && n < 2,
  },
  {
    id: 'strong_up',
    label: 'Strong up',
    subtitle: '≥ +2%',
    match: (n) => n >= 2,
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

/** Compact grid of all watchlist symbols clustered by session % change band. */
export default function SectorHeatmap({ items }) {
  const bySym = new Map();
  for (const it of items) {
    bySym.set(String(it.name || '').trim().toUpperCase(), it);
  }

  if (!items.length) return null;

  const rows = ALL_WATCHLIST_ENTRIES.map(([label, symbol]) => {
    const sym = String(symbol).trim().toUpperCase();
    const it = bySym.get(sym);
    const pct = it?.regular_change_pct;
    const n = Number(pct);
    const sortKey = pct == null || Number.isNaN(n) ? 999 : n;
    return { label, sym, it, pct, sortKey, bucket: bucketIndex(pct) };
  });

  const bucketRows = CHANGE_BUCKETS.map((bucket, idx) => ({
    ...bucket,
    tiles: rows
      .filter((r) => r.bucket === idx)
      .sort((a, b) => a.sortKey - b.sortKey),
  }));

  const noData = rows
    .filter((r) => r.bucket === CHANGE_BUCKETS.length)
    .sort((a, b) => a.sym.localeCompare(b.sym));

  return (
    <div className="rounded-xl border border-slate-700/90 bg-slate-900/50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Session heatmap
        </h2>
        <span className="text-[10px] text-slate-500">
          Regular session % · clustered by move
        </span>
      </div>
      <div className="space-y-3">
        {bucketRows.map(
          (band) =>
            band.tiles.length > 0 && (
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
                <div className="flex flex-wrap gap-1">
                  {band.tiles.map(({ label, sym, it, pct }) => {
                    const title = `${label} · ${formatChangePct(pct) ?? '—'}`;
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
              </div>
            ),
        )}
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
