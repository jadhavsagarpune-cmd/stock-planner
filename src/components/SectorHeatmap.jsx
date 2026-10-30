import { WATCHLIST_SECTIONS } from '../data/watchlist';
import { formatChangePct } from '../lib/stockFormat';

function heatColor(pct) {
  const n = Number(pct);
  if (pct == null || Number.isNaN(n)) return 'bg-slate-800/80 border-slate-700/50';
  if (n >= 2) return 'bg-emerald-600/50 border-emerald-500/40';
  if (n > 0) return 'bg-emerald-900/50 border-emerald-700/40';
  if (n <= -2) return 'bg-red-600/45 border-red-500/40';
  if (n < 0) return 'bg-red-900/45 border-red-700/40';
  return 'bg-slate-700/40 border-slate-600/40';
}

/** Compact grid of all watchlist symbols colored by session % change. */
export default function SectorHeatmap({ items }) {
  const bySym = new Map();
  for (const it of items) {
    bySym.set(String(it.name || '').trim().toUpperCase(), it);
  }

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-slate-700/90 bg-slate-900/50 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Session heatmap
        </h2>
        <span className="text-[10px] text-slate-500">Regular session % · all sections</span>
      </div>
      <div className="space-y-3">
        {WATCHLIST_SECTIONS.map((sec) => (
          <div key={sec.id}>
            <p className="text-[10px] text-slate-500 mb-1.5">{sec.title}</p>
            <div className="flex flex-wrap gap-1">
              {sec.entries.map(([label, symbol]) => {
                const sym = String(symbol).trim().toUpperCase();
                const it = bySym.get(sym);
                const pct = it?.regular_change_pct;
                const title = `${label} · ${formatChangePct(pct) ?? '—'}`;
                return (
                  <span
                    key={sym}
                    title={title}
                    className={`inline-flex flex-col items-center justify-center min-w-[2.75rem] px-1 py-1 rounded border text-[9px] font-mono tabular-nums ${heatColor(pct)}`}
                  >
                    <span className="text-slate-200 font-semibold">{sym.replace('.KS', '')}</span>
                    <span className="text-slate-400 scale-90">
                      {it?.status === 'done' ? formatChangePct(pct) ?? '—' : '…'}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
