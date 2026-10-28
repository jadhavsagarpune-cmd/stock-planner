import { formatStockPrice, preChangePctVsRegular } from '../lib/stockFormat';
import { exchangeHint } from '../data/watchlist';
import PriceChangeBadge from './PriceChangeBadge';

function QuoteRow({ it, preColumnMuted }) {
  const rowMuted = it.status === 'pending';
  const rowErr = it.status === 'failed';
  const full = it.label || it.name;
  const m = full.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const displayName = m ? m[1].trim() : full;
  const ticker = m ? m[2] : it.name;
  const market = exchangeHint(it.name);

  return (
    <tr className="border-t border-slate-800/60">
      <td
        className={`py-2 pr-2 text-sm leading-snug ${
          rowMuted ? 'text-slate-500' : 'text-slate-200'
        }`}
        title={`${full} · ${market}`}
      >
        {it.status === 'pending' && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 mr-2 align-middle animate-pulse" />
        )}
        <span className="font-medium block sm:inline">{displayName}</span>
        <span className="text-slate-500 text-xs block sm:inline sm:ml-1.5 font-mono">{ticker}</span>
        <span className="text-slate-600 text-[10px] block">{market}</span>
      </td>
      <td
        className={`py-2 pr-2 text-right text-sm whitespace-nowrap ${
          rowMuted ? 'text-slate-600' : ''
        }`}
      >
        {rowErr ? (
          <span className="text-amber-400/90 text-xs" title={it.error}>—</span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono tabular-nums text-white font-semibold text-xs sm:text-sm">
              {formatStockPrice(it.regular_price, it.currency)}
            </span>
            <PriceChangeBadge pct={it.regular_change_pct} />
          </div>
        )}
      </td>
      <td
        className={`py-2 text-right text-sm whitespace-nowrap ${
          rowMuted || preColumnMuted ? 'text-slate-600' : ''
        }`}
        title={preColumnMuted ? 'Pre-market not shown during US regular session' : undefined}
      >
        {rowErr || preColumnMuted ? (
          <span className="text-slate-600 font-mono">—</span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono tabular-nums text-violet-200 font-semibold text-xs sm:text-sm">
              {formatStockPrice(it.premarket_price, it.currency)}
            </span>
            <PriceChangeBadge
              pct={preChangePctVsRegular(it.premarket_price, it.regular_price)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function pinMrvlFirst(items) {
  const sym = (it) => String(it.name || '').trim().toUpperCase();
  const mrvl = items.filter((it) => sym(it) === 'MRVL');
  const rest = items.filter((it) => sym(it) !== 'MRVL');
  return [...mrvl, ...rest];
}

export default function SemiconductorQuotesTable({ items, preColumnMuted = false }) {
  if (!items.length) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">Tap Refresh to load quotes.</p>
    );
  }

  const ordered = pinMrvlFirst(items);
  const mid = Math.ceil(ordered.length / 2);
  const left = ordered.slice(0, mid);
  const right = ordered.slice(mid);

  const tableHead = (
    <thead>
      <tr className="text-slate-500 text-[11px] uppercase tracking-wide">
        <th className="font-semibold pb-2 text-left">Company</th>
        <th className="font-semibold pb-2 text-right w-28 sm:w-36">Current</th>
        <th
          className={`font-semibold pb-2 text-right w-28 sm:w-36 ${
            preColumnMuted ? 'text-slate-600' : ''
          }`}
        >
          Pre
        </th>
      </tr>
    </thead>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[280px]">
          {tableHead}
          <tbody>
            {left.map((it) => (
              <QuoteRow key={it.name} it={it} preColumnMuted={preColumnMuted} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[280px]">
          {tableHead}
          <tbody>
            {right.map((it) => (
              <QuoteRow key={it.name} it={it} preColumnMuted={preColumnMuted} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
