import {
  changeColorClass,
  formatMrvlInrHint,
  formatStockPrice,
} from '../lib/stockFormat';
import StockPriceChangeLines from './StockPriceChangeLines';
import { resolveYahooQuotePanels, yahooQuoteFooterStats } from '../lib/yahooHeroSessions';

function QuoteFooter({ quote, currency }) {
  const { parts } = yahooQuoteFooterStats(quote, currency);
  if (!parts.length) return null;
  const text = parts
    .map((p) =>
      p.low != null
        ? `${p.label} ${formatStockPrice(p.low, currency)} - ${formatStockPrice(p.high, currency)}`
        : `${p.label} ${formatStockPrice(p.value, currency)}`,
    )
    .join(' · ');
  return <p className="text-[10px] text-slate-500 leading-snug tabular-nums">{text}</p>;
}

function SessionPriceBlock({
  price,
  pct,
  abs,
  timeLabel,
  currency,
  fxRate,
  showInrChange,
  size = 'hero',
  muted = false,
}) {
  const priceSize =
    size === 'hero' ? 'text-2xl sm:text-[1.75rem] font-semibold' : 'text-sm sm:text-base font-semibold';
  const priceStr = price != null ? formatStockPrice(price, currency) : '—';
  const inrHint =
    showInrChange && fxRate != null && price != null ? formatMrvlInrHint(price, fxRate) : null;

  return (
    <div className={`min-w-0 ${muted ? 'opacity-95' : ''}`}>
      {price != null ? (
        <>
          <div
            className={`font-mono tabular-nums leading-none ${priceSize} ${changeColorClass(pct)}`}
          >
            {priceStr}
          </div>
          {inrHint ? (
            <span className="text-[10px] font-normal text-violet-300/80 block mt-0.5">{inrHint}</span>
          ) : null}
          {pct != null || abs != null ? (
            <div className="mt-1">
              <StockPriceChangeLines
                pct={pct}
                changeAbs={abs}
                currency={currency}
                fxRate={fxRate}
                showInrChange={showInrChange}
                className="!items-start !flex-row !gap-1.5 !text-xs sm:!text-sm"
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="font-mono text-slate-600 text-lg">—</div>
      )}
      {timeLabel ? (
        <div className="text-[10px] text-slate-500 mt-1.5 tabular-nums leading-snug">{timeLabel}</div>
      ) : null}
    </div>
  );
}

function TitleRow({ companyName, ticker }) {
  return (
    <h2 className="text-base sm:text-lg font-semibold text-slate-100 leading-tight">
      {companyName}{' '}
      <span className="text-slate-400 font-mono text-sm sm:text-base">({ticker})</span>
    </h2>
  );
}

function YahooSessionPanels({
  quote,
  currency,
  fxRate,
  showInrChange,
  size,
  panels,
  companyName,
  ticker,
  showTitle,
  className,
}) {
  if (panels.kind === 'dual') {
    return (
      <div className={`space-y-2 ${className}`}>
        {showTitle ? <TitleRow companyName={companyName} ticker={ticker} /> : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
          <SessionPriceBlock
            {...panels.atClose}
            currency={currency}
            fxRate={fxRate}
            showInrChange={showInrChange}
            size={size}
          />
          <SessionPriceBlock
            {...panels.extended}
            currency={currency}
            fxRate={fxRate}
            showInrChange={showInrChange}
            size={size}
          />
        </div>
        <QuoteFooter quote={quote} currency={currency} />
      </div>
    );
  }

  const row = panels.single ?? panels.atClose;
  return (
    <div className={`space-y-2 ${className}`}>
      {showTitle ? <TitleRow companyName={companyName} ticker={ticker} /> : null}
      <SessionPriceBlock
        {...row}
        currency={currency}
        fxRate={fxRate}
        showInrChange={showInrChange}
        size={size}
      />
      <QuoteFooter quote={quote} currency={currency} />
    </div>
  );
}

/**
 * Yahoo Finance quote panel: compact (holdings) or hero (MRVL chart).
 */
export default function YahooQuoteStrip({
  quote,
  currency = 'USD',
  fxRate = null,
  showInrChange = false,
  now = new Date(),
  size = 'md',
  layout = 'compact',
  companyName,
  ticker = 'MRVL',
  className = '',
}) {
  if (!quote) return null;

  const panels = resolveYahooQuotePanels(quote, now);
  const heroSize = 'hero';
  const compactSize = size === 'lg' ? 'lg' : 'compact';

  if (layout === 'hero') {
    return (
      <YahooSessionPanels
        quote={quote}
        currency={currency}
        fxRate={fxRate}
        showInrChange={showInrChange}
        size={heroSize}
        panels={panels}
        companyName={companyName ?? 'Marvell Technology, Inc.'}
        ticker={ticker}
        showTitle
        className={className}
      />
    );
  }

  return (
    <YahooSessionPanels
      quote={quote}
      currency={currency}
      fxRate={fxRate}
      showInrChange={showInrChange}
      size={compactSize}
      panels={panels}
      companyName={companyName}
      ticker={ticker}
      showTitle={false}
      className={className}
    />
  );
}