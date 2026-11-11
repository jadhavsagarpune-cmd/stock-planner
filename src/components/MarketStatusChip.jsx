import { marketStatusChip } from '../lib/sessionQuote';

const STYLES = {
  PRE: 'bg-amber-950/80 text-amber-200 border-amber-600/50',
  REG: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50',
  POST: 'bg-violet-950/80 text-violet-200 border-violet-600/50',
  CLOSED: 'bg-slate-800/80 text-slate-400 border-slate-600/50',
};

export default function MarketStatusChip({ quote, className = '' }) {
  const chip = marketStatusChip(quote);
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide tabular-nums ${STYLES[chip] ?? STYLES.CLOSED} ${className}`}
      title="Market session from quote metadata"
    >
      {chip}
    </span>
  );
}
