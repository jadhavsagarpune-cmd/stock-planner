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
  const forced = sessionModeFromBaselineId(baselineId);
  if (forced === 'pre') return 'pre';
  if (forced === 'post') return 'post';
  return clockExtendedMode;
}

/** Whether watchlist %/price in the active column come from heatmap baseline math. */
export function watchlistUsesBaselinePct(baselineId) {
  return !isSessionBaselineId(baselineId);
}

export function watchlistActiveColumnMeta(baselineId, clockExtendedMode) {
  if (watchlistUsesBaselinePct(baselineId)) {
    const meta = heatmapBaselineMeta(baselineId);
    return {
      label: meta.badge,
      subtitle: meta.badge === 'PREV' ? 'vs prior close' : 'vs reference',
      title: meta.subtitle,
    };
  }
  const mode = resolveWatchlistExtendedMode(baselineId, clockExtendedMode);
  if (mode === 'regular') {
    return {
      label: 'Live',
      subtitle: 'vs Previous Close',
      title:
        'Regular Market live price · day change vs Previous Close (LIVE baseline)',
    };
  }
  if (mode === 'post') {
    return {
      label: 'After Market',
      subtitle: 'vs Previous Close',
      title: 'After Market price · vs Previous Close',
    };
  }
  return {
    label: 'Pre-market',
    subtitle: 'vs Previous Close',
    title: 'Pre-market price · vs Previous Close',
  };
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