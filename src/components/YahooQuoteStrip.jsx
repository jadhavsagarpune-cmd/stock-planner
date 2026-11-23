import {
  changeColorClass,
  formatMrvlInrHint,
  formatStockPrice,
  pickExtendedQuote,
  pickRegularMarketDisplay,
} from '../lib/stockFormat';
import StockPriceChangeLines from './StockPriceChangeLines';
import { formatAtCloseTime, formatUsMarketTime } from '../lib/marketTimeFormat';
import {
  pickActiveSessionPrice,
  pickSessionDayChange,
  resolveActiveSession,
} from '../lib/sessionQuote';

function SessionColumn({
  title,
  timeLabel,
  price,
  pct,
  abs,
  currency,
  fxRate,
  showInrChange,
  muted,
  showChange = true,
}) {
  const priceStr = price != null ? formatStockPrice(price, currency) : '—';
  const inrHint =
    showInrChange && fxRate != null && price != null ? formatMrvlInrHint(price, fxRate) : null;
  return (
    <div className={`min-w-0 ${muted ? 'opacity-90' : ''}`}>
      <div className="text-[11px] font-semibold text-slate-200">{title}</div>
      {timeLabel ? (
        <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{timeLabel}</div>
      ) : null}
      <div className="text-sm sm:text-base font-semibold font-mono tabular-nums text-white mt-1">
        {priceStr}
        {inrHint ? (
          <span className="text-[10px] font-normal text-violet-300/80 block">{inrHint}</span>
        ) : null}
      </div>
      {price != null && showChange ? (
        <StockPriceChangeLines
          pct={pct}
          changeAbs={abs}
          currency={currency}
          fxRate={fxRate}
          showInrChange={showInrChange}
          className="!items-start !text-[10px] sm:!text-[11px] mt-0.5"
        />
      ) : price != null && !showChange ? null : (
        <span className="text-[10px] text-slate-600 block mt-1">—</span>
      )}
    </div>
  );
}

function YahooQuoteHero({
  quote,
  currency = 'USD',
  fxRate = null,
  showInrChange = false,
  companyName = 'Marvell Technology, Inc.',
  ticker = 'MRVL',
  className = '',
  now = new Date(),
}) {
  const session = resolveActiveSession(quote, now);
  const headlinePrice = pickActiveSessionPrice(quote, now);
  const dayChange = pickSessionDayChange(quote, now);
  const headlinePct = dayChange?.pct ?? null;
  const headlineAbs = dayChange?.abs ?? null;
  const headlineLabel =
    session === 'pre'
      ? 'Pre-market'
      : session === 'post'
        ? 'After-hours'
        : session === 'regular'
          ? 'Regular Market'
          : 'At close';

  let headlineTime = null;
  if (session === 'pre') headlineTime = formatUsMarketTime(quote.pre_market_time);
  else if (session === 'post') headlineTime = formatUsMarketTime(quote.post_market_time);
  else if (session === 'regular') headlineTime = null;
  else headlineTime = formatAtCloseTime(quote.regular_market_time);

  let secondary = null;
  if (session === 'pre') {
    secondary = {
      title: 'At close',
      timeLabel: formatAtCloseTime(quote.regular_market_time),
      price: quote.regular_price,
      pct: quote.regular_change_pct,
      abs: quote.regular_change_abs,
      showChange: true,
    };
  } else if (session === 'post') {
    const atClose = pickRegularMarketDisplay(quote, now);
    secondary = {
      title: 'At close',
      timeLabel: formatAtCloseTime(quote.regular_market_time),
      price: atClose?.preIdle ? quote.previous_close : (atClose?.price ?? quote.regular_price),
      pct: atClose?.preIdle ? null : (atClose?.pct ?? quote.regular_change_pct),
      abs: atClose?.preIdle ? null : (atClose?.abs ?? quote.regular_change_abs),
      showChange: !atClose?.preIdle,
    };
  }

  const dayHigh = quote.day_high;
  const dayLow = quote.day_low;
  const open = quote.regular_market_open;
  const w52Hi = quote.fifty_two_week_high;
  const w52Lo = quote.fifty_two_week_low;

  const footerParts = [
    quote.previous_close != null && {
      label: 'Previous Close',
      value: formatStockPrice(quote.previous_close, currency),
    },
    open != null && { label: 'Open', value: formatStockPrice(open, currency) },
    dayLow != null &&
      dayHigh != null && {
        label: "Day's Range",
        value: `${formatStockPrice(dayLow, currency)} - ${formatStockPrice(dayHigh, currency)}`,
      },
    w52Lo != null &&
      w52Hi != null && {
        label: '52 Week Range',
        value: `${formatStockPrice(w52Lo, currency)} - ${formatStockPrice(w52Hi, currency)}`,
      },
  ].filter(Boolean);

  return (
    <div className={`space-y-3 ${className}`}>
      <TitleRow companyName={companyName} ticker={ticker} />
      <div
        className={
          secondary
            ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8'
            : ''
        }
      >
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs text-slate-400 font-medium">{headlineLabel}</div>
          {headlineTime ? (
            <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{headlineTime}</div>
          ) : null}
          <div
            className={`font-mono text-3xl sm:text-4xl font-semibold tabular-nums leading-none mt-0.5 ${changeColorClass(headlinePct)}`}
          >
            {formatStockPrice(headlinePrice, currency)}
          </div>
          {headlinePct != null || headlineAbs != null ? (
            <div className="mt-1.5">
              <StockPriceChangeLines
                quote={quote}
                pct={headlinePct}
                changeAbs={headlineAbs}
                currency={currency}
                fxRate={fxRate}
                showInrChange={showInrChange}
                className="!items-start !text-xs sm:!text-sm"
              />
            </div>
          ) : null}
        </div>
        {secondary ? (
          <SessionColumn
            title={secondary.title}
            timeLabel={secondary.timeLabel}
            price={secondary.price}
            pct={secondary.pct}
            abs={secondary.abs}
            currency={currency}
            fxRate={fxRate}
            showInrChange={showInrChange}
            showChange={secondary.showChange}
            muted
          />
        ) : null}
      </div>
      {footerParts.length > 0 && (
        <div className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
          {footerParts.map((p) => (
            <span key={p.label}>
              <span className="text-slate-500">{p.label}</span>{' '}
              <span className="font-mono tabular-nums text-slate-300">{p.value}</span>
            </span>
          ))}
        </div>
      )}
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

  if (layout === 'hero') {
    return (
      <YahooQuoteHero
        quote={quote}
        currency={currency}
        fxRate={fxRate}
        showInrChange={showInrChange}
        companyName={companyName ?? 'Marvell Technology, Inc.'}
        ticker={ticker}
        className={className}
        now={now}
      />
    );
  }

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
      {!showPre && (
        <div>
          <div className={labelClass}>
            Regular Market
            {regularCell?.live ? (
              <span className="text-emerald-400/90 normal-case tracking-normal ml-1">live</span>
            ) : null}
          </div>
          <div className={`mt-0.5 font-mono tabular-nums text-white ${priceClass}`}>
            {regularCell?.preIdle ? (
              <span className="text-slate-500">—</span>
            ) : (
              <>
                {formatStockPrice(regularCell?.price ?? quote.regular_price, currency)}
                {regularInr && (
                  <span className="text-violet-300/90 font-normal ml-1 text-[10px] sm:text-xs">
                    ({regularInr})
                  </span>
                )}
              </>
            )}
          </div>
          {!regularCell?.preIdle ? (
            <StockPriceChangeLines
              quote={quote}
              pct={regularCell?.pct ?? quote.regular_change_pct}
              changeAbs={regularCell?.abs ?? quote.regular_change_abs}
              currency={currency}
              fxRate={fxRate}
              showInrChange={showInrChange}
              className="!items-start mt-0.5"
            />
          ) : null}
        </div>
      )}
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