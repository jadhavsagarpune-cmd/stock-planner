import { useEffect, useId, useState } from 'react';
import { formatChangePct, changeColorClass } from '../lib/stockFormat';
import { timeAgo } from '../lib/newsRank';

const TABS = [
  ['marvell', 'Marvell'],
  ['semis', 'Semis'],
  ['market', 'Market'],
];

export default function NewsPanel({ open, onClose, items, moves, loading, ok, windowHours, onRefresh }) {
  const titleId = useId();
  const [tab, setTab] = useState('marvell');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const list = (items || []).filter((i) => i.category === tab);
  const emptyText = loading
    ? 'Loading…'
    : !ok
      ? 'News unavailable right now. Try Refresh.'
      : `No ${windowHours > 24 ? 'recent ' : ''}headlines in this tab.`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md h-full overflow-y-auto bg-slate-900 border-l border-slate-700 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 id={titleId} className="text-base font-semibold text-white">Top news</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/30 text-violet-100 border border-violet-500/40 disabled:opacity-50"
            >
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-600"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex gap-1 mb-2" role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                tab === id
                  ? 'bg-violet-600/30 text-violet-100 border-violet-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {windowHours > 24 && ok ? (
          <p className="text-[11px] text-slate-500 mb-2">No news in the last 24h — showing the last {windowHours}h.</p>
        ) : null}
        {list.length === 0 ? (
          <p className="text-xs text-slate-500 py-4" role="status">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {list.map((it) => (
              <li key={it.url} className="py-2.5">
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-200 hover:text-white leading-snug"
                >
                  {it.title}
                </a>
                {it.summary ? <p className="text-xs text-slate-400 mt-1">{it.summary}</p> : null}
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                  <span>{it.publisher ? `${it.publisher} · ` : ''}{timeAgo(it.publishedAt)}</span>
                  {(it.tickers || [])
                    .filter((s) => moves.has(s))
                    .slice(0, 4)
                    .map((s) => (
                      <span
                        key={s}
                        className={`font-mono tabular-nums px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-700 ${changeColorClass(moves.get(s))}`}
                      >
                        {s} {formatChangePct(moves.get(s))}
                      </span>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
