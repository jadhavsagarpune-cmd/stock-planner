import {
  formatMrvlInrHint,
  formatStockPrice,
  pickExtendedQuote,
  pickRegularMarketDisplay,
} from '../lib/stockFormat';
import StockPriceChangeLines from './StockPriceChangeLines';
import { resolveActiveSession } from '../lib/sessionQuote';

/**
 * Yahoo Finance quote panel: Previous Close, Regular Market, After Market (POST only).
 */
export default function YahooQuoteStrip({
  quote,
  currency = 'USD',
  fxRate = null,
  showInrChange = false,
  now = new Date(),
  size = 'md',
  className = '',
}) {
  if (!quote) return null;

  const session = resolveActiveSession(quote, now);
  const showAfter = session === 'post';
  const showPre = session === 'pre';
  const regularCell = pickRegularMarketDisplay(quote, now);
  const regularInr =
    showInrChange && fxRate != null && regularCell?.price != null
      ? formatMrvlInrHint(regularCell.price, fxRate)
      : null;

  const ext = showAfter
    ? pickExtendedQuote(quote, 'post')
    : showPre
      ? pickExtendedQuote(quote, 'pre')
      : null;
  const extInr =
    showInrChange && fxRate != null && ext?.price != null
      ? formatMrvlInrHint(ext.price, fxRate)
      : null;

  const priceClass =
    size === 'lg'
      ? 'text-base sm:text-lg font-semibold'
      : 'text-xs sm:text-sm font-semibold';
  const labelClass = 'text-[10px] uppercase tracking-wide text-slate-500 font-medium';
  const rowGap = size === 'lg' ? 'space-y-2.5' : 'space-y-1.5';

  return (
    <div className={`${rowGap} ${className}`}>
      <div>
        <div className={labelClass}>Previous Close</div>
        <div className={`mt-0.5 font-mono tabular-nums text-slate-300 ${priceClass}`}>
          {formatStockPrice(quote.previous_close, currency)}
        </div>
      </div>
      <div>
        <div className={labelClass}>
          Regular Market
          {regularCell?.live ? (
            <span className="text-emerald-400/90 normal-case tracking-normal ml-1">live</span>
          ) : null}
        </div>
        <div className={`mt-0.5 font-mono tabular-nums text-white ${priceClass}`}>
          {formatStockPrice(regularCell?.price ?? quote.regular_price, currency)}
          {regularInr && (
            <span className="text-violet-300/90 font-normal ml-1 text-[10px] sm:text-xs">
              ({regularInr})
            </span>
          )}
        </div>
        <StockPriceChangeLines
          quote={quote}
          pct={regularCell?.pct ?? quote.regular_change_pct}
          changeAbs={regularCell?.abs ?? quote.regular_change_abs}
          currency={currency}
          fxRate={fxRate}
          showInrChange={showInrChange}
          className="!items-start mt-0.5"
        />
      </div>
      {showAfter && ext?.price != null && (
        <div>
          <div className={labelClass}>After Market</div>
          <div className={`mt-0.5 font-mono tabular-nums text-violet-100 ${priceClass}`}>
            {formatStockPrice(ext.price, currency)}
            {extInr && (
              <span className="text-violet-300/80 font-normal ml-1 text-[10px] sm:text-xs">
                ({extInr})
              </span>
            )}
          </div>
          <StockPriceChangeLines
            pct={ext.pct}
            changeAbs={ext.abs}
            currency={currency}
            fxRate={fxRate}
            showInrChange={showInrChange}
            className="!items-start mt-0.5"
          />
        </div>
      )}
      {showPre && ext?.price != null && (
        <div>
          <div className={labelClass}>Pre-market</div>
          <div className={`mt-0.5 font-mono tabular-nums text-amber-100 ${priceClass}`}>
            {formatStockPrice(ext.price, currency)}
            {extInr && (
              <span className="text-violet-300/80 font-normal ml-1 text-[10px] sm:text-xs">
                ({extInr})
              </span>
            )}
          </div>
          <StockPriceChangeLines
            pct={ext.pct}
            changeAbs={ext.abs}
            currency={currency}
            fxRate={fxRate}
            showInrChange={showInrChange}
            className="!items-start mt-0.5"
          />
        </div>
      )}
    </div>
  );
}