/** Consistent microchip marker shown wherever Marvell (MRVL) appears in a group. */
export default function MarvellMarker({ className = '', size = 12 }) {
  return (
    <svg
      className={`shrink-0 text-amber-400 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="5" y="5" width="6" height="6" rx="0.5" fill="currentColor" />
      <rect x="7" y="0.5" width="2" height="2.5" rx="0.4" />
      <rect x="7" y="13" width="2" height="2.5" rx="0.4" />
      <rect x="0.5" y="7" width="2.5" height="2" rx="0.4" />
      <rect x="13" y="7" width="2.5" height="2" rx="0.4" />
    </svg>
  );
}

export function MarvellTickerBadge({ symbol, className = '' }) {
  const sym = String(symbol || 'MRVL').trim().toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      title="Marvell Technology"
    >
      <MarvellMarker size={11} />
      <span className="font-mono font-bold text-amber-200 tabular-nums">{sym.replace('.KS', '')}</span>
    </span>
  );
}
