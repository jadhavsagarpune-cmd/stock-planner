import {
  pickExtendedQuote,
  pickHeatmapChangePct,
  pickHeatmapPrice,
  pickRegularMarketDisplay,
} from './stockFormat.js';
import {
  formatAfterHoursLabel,
  formatAtCloseLabel,
  formatMarketOpenLabel,
  formatPreMarketLabel,
} from './marketTimeFormat.js';
import {
  closedExtendedModeByClock,
  isUsRegularSessionByClock,
} from './stockMarketSession.js';
import { resolveActiveSession } from './sessionQuote.js';
import {
  pickHeatmapChangePctForBaseline,
  pickHeatmapPriceForBaseline,
  heatmapBaselineMeta,
} from './heatmapBaselines.js';
import {
  sessionModeFromBaselineId,
  watchlistUsesBaselinePct,
} from './marketViewMode.js';
function atCloseRow(quote, now) {
  const cell = pickRegularMarketDisplay(quote, now);
  const price = cell?.preIdle ? quote.regular_price : (cell?.price ?? quote.regular_price);
  const pct = cell?.preIdle ? quote.regular_change_pct : (cell?.pct ?? quote.regular_change_pct);
  const abs = cell?.preIdle ? quote.regular_change_abs : (cell?.abs ?? quote.regular_change_abs);
  return {
    price,
    pct,
    abs,
    timeLabel: formatAtCloseLabel(quote.regular_market_time),
  };
}

/**
 * Yahoo Finance hero / compact pair: at-close + extended or single live block.
 * @returns {{ kind: 'historical'|'dual'|'single', historical?, atClose?, extended?, single? }}
 */
export function resolveYahooQuotePanels(quote, now = new Date(), viewBaselineId = null, viewBaselineDaily = null) {
  if (!quote) return { kind: 'single', atClose: null, extended: null, single: null };

  const forcedSession = viewBaselineId ? sessionModeFromBaselineId(viewBaselineId) : null;
  const historicalView = viewBaselineId && watchlistUsesBaselinePct(viewBaselineId);

  if (historicalView) {
    return {
      kind: 'historical',
      historical: {
        price: pickHeatmapPriceForBaseline(quote, viewBaselineId, viewBaselineDaily),
        pct: pickHeatmapChangePctForBaseline(quote, viewBaselineId, viewBaselineDaily),
        meta: heatmapBaselineMeta(viewBaselineId, closedExtendedModeByClock(now)),
      },
    };
  }

  if (forcedSession === 'pre' || forcedSession === 'post' || forcedSession === 'regular') {
    const mode = forcedSession;
    if (mode === 'regular') {
      const price = pickHeatmapPrice(quote, 'regular') ?? quote.regular_price;
      const pct = pickHeatmapChangePct(quote, 'regular');
      return {
        kind: 'single',
        single: {
          price,
          pct,
          abs: quote.regular_change_abs,
          timeLabel: formatAtCloseLabel(quote.regular_market_time),
        },
      };
    }
    const atClose = atCloseRow(quote, now);
    const ext = pickExtendedQuote(quote, mode);
    if (ext?.price != null) {
      return {
        kind: 'dual',
        atClose,
        extended: {
          kind: mode,
          price: ext.price,
          pct: ext.pct,
          abs: ext.abs,
          timeLabel:
            mode === 'pre'
              ? formatPreMarketLabel(quote.pre_market_time)
              : formatAfterHoursLabel(quote.post_market_time),
        },
      };
    }
    return { kind: 'single', single: { ...atClose }, atClose };
  }

  const session = resolveActiveSession(quote, now);
  const clockPost = closedExtendedModeByClock(now) === 'post';
  const clockPre = closedExtendedModeByClock(now) === 'pre';
  const rth = isUsRegularSessionByClock(now) && session === 'regular';

  if (rth) {
    const cell = pickRegularMarketDisplay(quote, now);
    const price = quote.current_price ?? cell?.price ?? quote.regular_price;
    const pct = cell?.pct ?? quote.regular_change_pct;
    const abs = cell?.abs ?? quote.regular_change_abs;
    return {
      kind: 'single',
      single: {
        price,
        pct,
        abs,
        timeLabel: formatMarketOpenLabel(quote.regular_market_time),
        live: true,
      },
    };
  }

  const atClose = atCloseRow(quote, now);

  if (session === 'pre' || clockPre) {
    const ext = pickExtendedQuote(quote, 'pre');
    if (ext?.price != null) {
      return {
        kind: 'dual',
        atClose,
        extended: {
          kind: 'pre',
          price: ext.price,
          pct: ext.pct,
          abs: ext.abs,
          timeLabel: formatPreMarketLabel(quote.pre_market_time),
        },
      };
    }
  }

  const postExt = pickExtendedQuote(quote, 'post');
  if (postExt?.price != null) {
    return {
      kind: 'dual',
      atClose,
      extended: {
        kind: 'post',
        price: postExt.price,
        pct: postExt.pct,
        abs: postExt.abs,
        timeLabel: formatAfterHoursLabel(quote.post_market_time),
      },
    };
  }

  if (session === 'post' || clockPost) {
    return { kind: 'single', single: { ...atClose }, atClose };
  }

  return { kind: 'single', single: { ...atClose }, atClose };
}

export function yahooQuoteFooterStats(quote, currency) {
  const dayHigh = quote?.day_high;
  const dayLow = quote?.day_low;
  const w52Hi = quote?.fifty_two_week_high;
  const w52Lo = quote?.fifty_two_week_low;
  const parts = [];
  if (quote?.previous_close != null) {
    parts.push({ label: 'Previous Close', value: quote.previous_close });
  }
  if (dayLow != null && dayHigh != null) {
    parts.push({ label: "Day's Range", low: dayLow, high: dayHigh });
  }
  if (w52Lo != null && w52Hi != null) {
    parts.push({ label: '52 Week Range', low: w52Lo, high: w52Hi });
  }
  return { parts, currency };
}