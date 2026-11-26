import { pickExtendedQuote } from './stockFormat.js';
import {
  formatAfterHoursLabel,
  formatAtCloseLabel,
  formatMarketOpenLabel,
  formatPreMarketLabel,
} from './marketTimeFormat.js';
import { closedExtendedModeByClock, isUsRegularSessionByClock } from './stockMarketSession.js';
import { resolveActiveSession } from './sessionQuote.js';

function atCloseRow(quote) {
  return {
    price: quote.regular_price,
    pct: quote.regular_change_pct,
    abs: quote.regular_change_abs,
    timeLabel: formatAtCloseLabel(quote.regular_market_time),
  };
}

function extendedRow(quote, mode) {
  const ext = pickExtendedQuote(quote, mode);
  if (ext?.price == null) return null;
  return {
    kind: mode,
    price: ext.price,
    pct: ext.pct,
    abs: ext.abs,
    timeLabel:
      mode === 'pre'
        ? formatPreMarketLabel(quote.pre_market_time)
        : formatAfterHoursLabel(quote.post_market_time),
  };
}

/**
 * Yahoo Finance hero / compact pair (always follows the US session clock, never a filter):
 * - regular session: one live block
 * - otherwise: "At close" + "Pre-market" or "After hours" when an extended price exists
 * @returns {{ kind: 'dual'|'single', atClose?, extended?, single? }}
 */
export function resolveYahooQuotePanels(quote, now = new Date()) {
  if (!quote) return { kind: 'single', atClose: null, extended: null, single: null };

  const session = resolveActiveSession(quote, now);
  if (isUsRegularSessionByClock(now) && session === 'regular') {
    return {
      kind: 'single',
      single: {
        price: quote.current_price ?? quote.regular_price,
        pct: quote.regular_change_pct,
        abs: quote.regular_change_abs,
        timeLabel: formatMarketOpenLabel(quote.regular_market_time),
      },
    };
  }

  const atClose = atCloseRow(quote);
  const clockMode = closedExtendedModeByClock(now);
  const order = session === 'pre' || clockMode === 'pre' ? ['pre', 'post'] : ['post', 'pre'];
  for (const mode of order) {
    const extended = extendedRow(quote, mode);
    if (extended) return { kind: 'dual', atClose, extended };
  }
  return { kind: 'single', single: atClose, atClose };
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