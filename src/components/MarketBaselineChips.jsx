import { HEATMAP_BASELINES, heatmapBaselinePickerGroups } from '../lib/heatmapBaselines';
import { heatmapSessionMeta } from '../lib/stockMarketSession';

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

const CLOCK_RING = {
  live: 'ring-1 ring-emerald-400/50',
  pre: 'ring-1 ring-amber-400/50',
  post: 'ring-1 ring-violet-400/50',
};

function baselineMatchesClock(b, clockSession) {
  if (!clockSession) return false;
  if (b.id === 'live') return clockSession === 'regular';
  return b.sessionMode === clockSession;
}

export function MarketBaselineChip({
  b,
  baselineId,
  onBaselineChange,
  theme = 'violet',
  className = '',
  clockSession = null,
}) {
  const active = b.id === baselineId;
  const t = ACTIVE_THEMES[theme] ?? ACTIVE_THEMES.violet;
  const clockNow = !active && baselineMatchesClock(b, clockSession);
  const ring = clockNow ? CLOCK_RING[b.id === 'live' ? 'live' : b.sessionMode] ?? '' : '';
  return (
    <button
      type="button"
      onClick={() => onBaselineChange?.(b.id)}
      className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold tracking-wide transition-colors ${className} ${
        active ? t.active : t.idle
      } ${ring}`}
      title={clockNow ? `${b.subtitle} · US session now` : b.subtitle}
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
  clockSession = 'regular',
  showClockPill = true,
}) {
  if (!onBaselineChange) return null;
  const { session } = heatmapBaselinePickerGroups();
  const clockMeta = heatmapSessionMeta(clockSession);
  return (
    <div
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 shrink-0 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {showClockPill && clockSession !== 'regular' ? (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wider shrink-0 ${clockMeta.badgeClass}`}
          title={`US session now · ${clockMeta.subtitle}`}
        >
          {clockMeta.badge}
        </span>
      ) : null}
      {session.map((b) => (
        <MarketBaselineChip
          key={b.id}
          b={b}
          baselineId={baselineId}
          onBaselineChange={onBaselineChange}
          theme={theme}
          clockSession={clockSession}
        />
      ))}
    </div>
  );
}

/** Single scroll row: LIVE · PRE · POST · PREV · 1D · … */
export function MarketBaselineAllRow({
  baselineId,
  onBaselineChange,
  theme = 'violet',
  ariaLabel = 'Market quote baselines',
  className = '',
}) {
  if (!onBaselineChange) return null;
  return (
    <div
      className={`flex gap-1 w-full overflow-x-auto overflow-y-hidden flex-nowrap pb-0.5 -mx-0.5 px-0.5 snap-x snap-mandatory scrollbar-thin ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {HEATMAP_BASELINES.map((b) => (
        <MarketBaselineChip
          key={b.id}
          b={b}
          baselineId={baselineId}
          onBaselineChange={onBaselineChange}
          theme={theme}
          className="shrink-0 snap-start"
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