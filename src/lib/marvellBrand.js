import { MRVL_SYMBOL } from './stockPriceAlerts';

export { MRVL_SYMBOL as MARVELL_TICKER };

/** Marvell corporate red–amber accent — distinct from violet UI chrome and green/red movers. */
export const MARVELL_ACCENT_RING =
  'ring-2 ring-amber-400/75 ring-inset shadow-[0_0_10px_rgba(251,191,36,0.15)]';
export const MARVELL_ROW_BG = 'bg-amber-950/30';
export const MARVELL_ROW_BORDER = 'border-l-[3px] border-l-amber-400/90';
export const MARVELL_NAME_TEXT = 'text-amber-50';
export const MARVELL_TICKER_CHIP =
  'inline-flex items-center gap-0.5 px-1 py-px rounded border border-amber-500/50 bg-amber-950/60 text-amber-200 font-mono font-bold text-[10px]';
export const MARVELL_HERO_PANEL =
  'border-amber-500/45 bg-gradient-to-br from-amber-950/40 via-slate-900/80 to-slate-900/80';
export const MARVELL_MOVER_CHIP =
  'border-amber-500/45 bg-amber-950/50 text-amber-100 ring-1 ring-amber-400/35';

/**
 * True for Marvell Technology (NASDAQ: MRVL) — ticker or display name/label.
 * Does not match unrelated "Marvel" strings without Marvell/MRVL context.
 */
export function isMarvellCompany(nameOrTicker) {
  const raw = String(nameOrTicker ?? '').trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (upper === MRVL_SYMBOL) return true;
  if (upper.includes('MRVL')) return true;
  if (/MARVELL/i.test(raw)) return true;
  return false;
}

export function marvellDisplayTicker(symbol) {
  return String(symbol || MRVL_SYMBOL).trim().toUpperCase().replace('.KS', '');
}
