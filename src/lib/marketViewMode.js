import {
  HEATMAP_BASELINES,
  heatmapBaselineMeta,
  pickHeatmapChangePctForBaseline,
} from './heatmapBaselines.js';
import { pickHeatmapChangePct } from './stockFormat.js';

/**
 * @returns {'pre'|'post'|'regular'|null} when baseline forces quote/column session UI.
 * `live` is filter-only (regular-session %); UI session follows the market clock.
 */
export function sessionModeFromBaselineId(baselineId) {
  if (baselineId === 'live') return null;
  const spec = HEATMAP_BASELINES.find((b) => b.id === baselineId);
  return spec?.sessionMode ?? null;
}

export function isSessionBaselineId(baselineId) {
  return sessionModeFromBaselineId(baselineId) != null;
}

/**
 * Watchlist column mode: session baselines override US clock; otherwise follow clock.
 */
export function resolveWatchlistExtendedMode(baselineId, clockExtendedMode) {
  if (baselineId === 'live') {
    // LIVE = regular session vs previous close: live tick in RTH, last close otherwise.
    return clockExtendedMode === 'regular' ? 'regular' : 'holiday';
  }
  const forced = sessionModeFromBaselineId(baselineId);
  if (forced === 'pre') return 'pre';
  if (forced === 'post') return 'post';
  return clockExtendedMode;
}

/** Whether watchlist %/price in the active column come from heatmap baseline math. */
export function watchlistUsesBaselinePct(baselineId) {
  if (baselineId === 'live') return false;
  return !isSessionBaselineId(baselineId);
}

export function watchlistActiveColumnMeta(baselineId, clockExtendedMode) {
  if (watchlistUsesBaselinePct(baselineId)) {
    const meta = heatmapBaselineMeta(baselineId, clockExtendedMode);
    return {
      label: meta.badge,
      subtitle: meta.base?.subtitle ?? '',
      title: meta.base?.subtitle ?? '',
    };
  }
  const mode = resolveWatchlistExtendedMode(baselineId, clockExtendedMode);
  if (mode === 'regular') {
    return { label: 'Live', subtitle: 'vs previous close', title: 'Regular session vs previous close' };
  }
  if (mode === 'holiday') {
    return {
      label: 'Last close',
      subtitle: 'vs previous close',
      title: 'Last regular session vs previous close',
    };
  }
  if (mode === 'post') {
    return { label: 'After hours', subtitle: 'vs at close', title: 'After hours vs at close' };
  }
  return { label: 'Pre-market', subtitle: 'vs at close', title: 'Pre-market vs at close' };
}

export function watchlistRowChangePct(it, baselineId, clockExtendedMode, daily = null) {
  if (!it || it.status !== 'done') return null;
  if (watchlistUsesBaselinePct(baselineId)) {
    return pickHeatmapChangePctForBaseline(it, baselineId, daily);
  }
  if (baselineId === 'live') {
    return pickHeatmapChangePct(it, 'regular');
  }
  const mode = resolveWatchlistExtendedMode(baselineId, clockExtendedMode);
  return pickHeatmapChangePct(it, mode === 'regular' ? 'regular' : mode);
}