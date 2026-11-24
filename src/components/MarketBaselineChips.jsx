import { heatmapBaselinePickerGroups } from '../lib/heatmapBaselines';

const ACTIVE_THEMES = {
  violet: {
    active: 'bg-violet-600/35 text-violet-100 border-violet-500/50',
    idle: 'bg-slate-900/60 text-slate-400 border-slate-700/80 hover:border-slate-500/60 hover:text-slate-200',
  },
  amber: {
    active: 'bg-amber-500/25 text-amber-100 border-amber-400/60',
    idle: 'bg-slate-950/40 text-slate-400 border-slate-600/50 hover:border-amber-500/35 hover:text-amber-200/90',
  },
  slate: {
    active: 'bg-slate-700/80 text-slate-100 border-slate-500/60',
    idle: 'bg-slate-950/60 text-slate-400 border-slate-700/80 hover:border-slate-500/60 hover:text-slate-200',
  },
};

export function MarketBaselineChip({ b, baselineId, onBaselineChange, theme = 'violet', className = '' }) {
  const active = b.id === baselineId;
  const t = ACTIVE_THEMES[theme] ?? ACTIVE_THEMES.violet;
  return (
    <button
      type="button"
      onClick={() => onBaselineChange?.(b.id)}
      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide transition-colors ${className} ${
        active ? t.active : t.idle
      }`}
      title={b.subtitle}
      aria-pressed={active}
    >
      {b.badge}
    </button>
  );
}

/** LIVE · PRE · POST */
export function MarketBaselineSessionRow({
  baselineId,
  onBaselineChange,
  theme = 'violet',
  ariaLabel = 'Market session baselines',
  className = '',
}) {
  if (!onBaselineChange) return null;
  const { session } = heatmapBaselinePickerGroups();
  return (
    <div
      className={`flex flex-nowrap gap-1 shrink-0 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {session.map((b) => (
        <MarketBaselineChip
          key={b.id}
          b={b}
          baselineId={baselineId}
          onBaselineChange={onBaselineChange}
          theme={theme}
        />
      ))}
    </div>
  );
}

/** PREV · 1D · 3D · … */
export function MarketBaselineHistoryRow({
  baselineId,
  onBaselineChange,
  theme = 'violet',
  ariaLabel = 'Market historical baselines',
  className = '',
  scrollable = true,
}) {
  if (!onBaselineChange) return null;
  const { history } = heatmapBaselinePickerGroups();
  const scroll =
    scrollable
      ? 'w-full overflow-x-auto overflow-y-hidden flex-nowrap pb-0.5 -mx-0.5 px-0.5 snap-x snap-mandatory scrollbar-thin'
      : 'flex-wrap';
  return (
    <div className={`flex gap-1 ${scroll} ${className}`} role="group" aria-label={ariaLabel}>
      {history.map((b) => (
        <MarketBaselineChip
          key={b.id}
          b={b}
          baselineId={baselineId}
          onBaselineChange={onBaselineChange}
          theme={theme}
          className={scrollable ? 'shrink-0 snap-start' : ''}
        />
      ))}
    </div>
  );
}