import { formatChangePct, changeColorClass } from '../lib/stockFormat';
import { timeAgo } from '../lib/newsRank';

function Headline({ it, moves }) {
  const sym = it.tickers?.find((s) => moves.has(s));
  const pct = sym ? moves.get(sym) : null;
  return (
    <a
      href={it.url}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto cursor-pointer inline-flex items-center gap-1.5 px-4 py-1 text-xs text-slate-300 hover:text-white hover:underline whitespace-nowrap"
    >
      {sym && pct != null ? (
        <span className={`font-mono tabular-nums ${changeColorClass(pct)}`}>
          {sym} {formatChangePct(pct)}
        </span>
      ) : null}
      <span>{it.title}</span>
      <span className="text-slate-600">· {it.publisher ? `${it.publisher} · ` : ''}{timeAgo(it.publishedAt)}</span>
    </a>
  );
}

export default function NewsTicker({ items, moves, loading, onOpen }) {
  const list = (items || []).slice(0, 15);
  if (!list.length) {
    return (
      <p className="mb-3 text-[11px] text-slate-600" role="status">
        {loading ? 'Loading news…' : 'No recent headlines.'}
      </p>
    );
  }
  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/80 overflow-hidden" aria-label="Top news ticker">
      <style>{`
        .news-marquee{display:inline-flex;animation:news-scroll ${Math.max(40, list.length * 8)}s linear infinite}
        .news-wrap:hover .news-marquee,.news-wrap:focus-within .news-marquee{animation-play-state:paused}
        @keyframes news-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @media (prefers-reduced-motion: reduce){.news-marquee{animation:none}.news-wrap{overflow-x:auto}}
      `}</style>
      {/* Mobile: compact list */}
      <ul className="sm:hidden divide-y divide-slate-800">
        {list.slice(0, 3).map((it) => (
          <li key={it.url} className="py-1.5">
            <Headline it={it} moves={moves} />
          </li>
        ))}
        <li className="px-4 py-1.5">
          <button type="button" onClick={onOpen} className="text-xs text-violet-300">All news →</button>
        </li>
      </ul>
      <div className="news-wrap hidden sm:block overflow-hidden py-1 relative z-10">
        <div className="news-marquee">
          {[0, 1].map((k) => (
            <span key={k} className="inline-flex">
              {list.map((it) => (
                <Headline key={`${k}-${it.url}`} it={it} moves={moves} />
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
