import {
  changeColorClass,
  deriveRegularChangeAbsFromRow,
  formatChangePctParen,
  formatMrvlInrChangeHint,
  formatSignedChangeAmount,
} from '../lib/stockFormat';

/**
 * Yahoo-style session change under price: signed $/local amount, then (pct%).
 * MRVL: optional INR equivalent of USD change on the amount line.
 */
export default function StockPriceChangeLines({
  quote,
  pct,
  changeAbs,
  currency = 'USD',
  fxRate = null,
  showInrChange = false,
  className = '',
}) {
  const effectivePct = pct ?? quote?.regular_change_pct;
  let abs = changeAbs;
  if (abs == null && quote) abs = deriveRegularChangeAbsFromRow(quote);
  const amountLabel = formatSignedChangeAmount(abs, currency);
  const pctLabel = formatChangePctParen(effectivePct);
  if (!amountLabel && !pctLabel) return null;

  const color = changeColorClass(effectivePct);
  const inrChange =
    showInrChange && abs != null && fxRate != null
      ? formatMrvlInrChangeHint(abs, fxRate)
      : null;

  return (
    <div
      className={`flex flex-col items-end leading-tight tabular-nums font-semibold text-[10px] sm:text-[11px] ${className}`}
    >
      {amountLabel && (
        <span className={color}>
          {amountLabel}
          {inrChange && (
            <span className="text-violet-300/90 font-normal ml-1">({inrChange})</span>
          )}
        </span>
      )}
      {pctLabel && <span className={color}>{pctLabel}</span>}
    </div>
  );
}
