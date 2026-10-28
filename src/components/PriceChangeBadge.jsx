import { formatChangePct } from '../lib/stockFormat';

export default function PriceChangeBadge({ pct, className = '' }) {
  const label = formatChangePct(pct);
  if (!label) return null;
  const n = Number(pct);
  const color = n > 0
    ? 'text-emerald-400'
    : n < 0
      ? 'text-red-400'
      : 'text-slate-500';
  const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '•';

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap ${color} ${className}`}
    >
      <span className="text-[8px] leading-none" aria-hidden>{arrow}</span>
      {label}
    </span>
  );
}
