import { useMemo, useState } from 'react';
import { WATCHLIST_SECTIONS, exchangeHint } from '../data/watchlist';
import {
  formatChangePct,
  formatMrvlInrHint,
  formatStockPrice,
  pickExtendedQuote,
} from '../lib/stockFormat';
import {
  extendedColumnLabel,
  isExtendedColumnMuted,
} from '../lib/stockMarketSession';
import {
  SORT_OPTIONS,
  sectionSummaryStats,
  sortWatchlistItems,
  topMoversByRegularPct,
} from '../lib/watchlistAnalytics';
import { ETF_BENCHMARKS, etfPctColorClass, formatEtfChipPct } from '../lib/etfBenchmarks';
import StockPriceChangeLines from './StockPriceChangeLines';

function extendedColumnTitle(mode) {
  if (mode === 'regular') return 'Extended hours hidden during US regular session';
  if (mode === 'post') return 'After-hours vs regular close';
  return 'Pre-market vs regular close';
}

function QuoteRow({ it, extendedMode, fxRate, compact }) {
  const rowMuted = it.status === 'pending';
  const rowErr = it.status === 'failed';
  const full = it.label || it.name;
  const m = full.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const displayName = m ? m[1].trim() : full;
  const ticker = m ? m[2] : it.name;
  const symbol = String(it.name || ticker).trim();
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${symbol} stock`)}`;
  const market = exchangeHint(it.name);
  const columnMuted = isExtendedColumnMuted(extendedMode);
  const ext = pickExtendedQuote(it, extendedMode);
  const isMrvl = symbol.toUpperCase() === 'MRVL';
  const inrHint =
    isMrvl && fxRate != null && it.regular_price != null
      ? formatMrvlInrHint(it.regular_price, fxRate)
      : null;
  const extInrHint =
    isMrvl && fxRate != null && ext?.price != null ? formatMrvlInrHint(ext.price, fxRate) : null;

  return (
    <tr className={`border-t border-slate-800/60 ${compact ? 'text-xs' : ''}`}>
      <td className={`${compact ? 'py-1.5' : 'py-2'} pr-2 text-sm leading-snug`}>
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`block cursor-pointer hover:underline ${
            rowMuted ? 'text-slate-500' : 'text-slate-200'
          }`}
          title={`Search ${symbol} on Google · ${market}`}
        >
          {it.status === 'pending' && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 mr-2 align-middle animate-pulse" />
          )}
          <span className={`font-medium block sm:inline ${compact ? 'text-xs' : ''}`}>
            {displayName}
          </span>
          <span className="text-slate-500 text-xs block sm:inline sm:ml-1.5 font-mono">{ticker}</span>
          {!compact && <span className="text-slate-600 text-[10px] block">{market}</span>}
        </a>
      </td>
      <td
        className={`${compact ? 'py-1.5' : 'py-2'} pr-2 text-right text-sm whitespace-nowrap ${
          rowMuted ? 'text-slate-600' : ''
        }`}
      >
        {rowErr ? (
          <span className="text-amber-400/90 text-xs" title={it.error}>
            —
          </span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono tabular-nums text-white font-semibold text-xs sm:text-sm">
              {formatStockPrice(it.regular_price, it.currency)}
              {inrHint && (
                <span className="text-violet-300/90 font-normal ml-1">({inrHint})</span>
              )}
            </span>
            <StockPriceChangeLines
              quote={it}
              pct={it.regular_change_pct}
              currency={it.currency}
              fxRate={fxRate}
              showInrChange={isMrvl}
            />
          </div>
        )}
      </td>
      <td
        className={`${compact ? 'py-1.5' : 'py-2'} text-right text-sm whitespace-nowrap ${
          rowMuted || columnMuted ? 'text-slate-600' : ''
        }`}
        title={extendedColumnTitle(extendedMode)}
      >
        {rowErr || columnMuted ? (
          <span className="text-slate-600 font-mono">—</span>
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-mono tabular-nums text-violet-200 font-semibold text-xs sm:text-sm">
              {formatStockPrice(ext?.price, it.currency)}
              {extInrHint && (
                <span className="text-violet-300/80 font-normal ml-1">({extInrHint})</span>
              )}
            </span>
            <StockPriceChangeLines
              pct={ext?.pct}
              changeAbs={ext?.abs}
              currency={it.currency}
              fxRate={fxRate}
              showInrChange={isMrvl}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

function MoverChip({ label, it, tone }) {
  if (!it) return null;
  const sym = String(it.name || '').trim();
  const pct = formatChangePct(it.regular_change_pct);
  const toneClass =
    tone === 'up'
      ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200'
      : 'border-red-500/30 bg-red-950/40 text-red-200';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs px-2 py-0.5 rounded-md border tabular-nums ${toneClass}`}
      title={`${label}: ${it.label || sym}`}
    >
      <span className="text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="font-mono font-semibold">{sym}</span>
      {pct && <span>{pct}</span>}
    </span>
  );
}

function EtfBenchmarkChips({ etfBenchmarks }) {
  if (!etfBenchmarks) return null;
  return (
    <>
      <span className="text-slate-600 hidden sm:inline">·</span>
      <span className="text-slate-500 text-[10px] uppercase tracking-wide">ETFs</span>
      {ETF_BENCHMARKS.map(({ symbol, label }) => {
        const row = etfBenchmarks[symbol];
        const pct = row?.regular_change_pct;
        return (
          <span
            key={symbol}
            className="inline-flex items-center gap-1 text-[10px] tabular-nums px-1.5 py-0.5 rounded border border-slate-700/80 bg-slate-950/60"
            title={`${label} session change`}
          >
            <span className="font-mono text-slate-400">{label}</span>
            <span className={`font-semibold ${etfPctColorClass(pct)}`}>
              {formatEtfChipPct(pct)}
            </span>
          </span>
        );
      })}
    </>
  );
}

function SectionBlock({
  section,
  itemsBySymbol,
  extendedMode,
  fxRate,
  sortKey,
  compact,
  collapsed,
  onToggleCollapse,
  onSectionSortChange,
  etfBenchmarks,
}) {
  const sectionItems = useMemo(() => {
    const rows = section.entries.map(([label, symbol]) => {
      const sym = String(symbol).trim().toUpperCase();
      const found = itemsBySymbol.get(sym);
      if (found) return found;
      return { name: symbol, label, status: 'pending' };
    });
    return sortWatchlistItems(rows, sortKey, extendedMode, {
      pinMrvlFirst: sortKey === 'default' && section.id === 'semiconductors',
    });
  }, [section, itemsBySymbol, sortKey, extendedMode]);

  const stats = sectionSummaryStats(sectionItems);
  const movers = topMoversByRegularPct(sectionItems);
  const columnMuted = isExtendedColumnMuted(extendedMode);
  const extLabel = extendedColumnLabel(extendedMode);

  return (
    <section className="rounded-xl border border-slate-700/90 bg-slate-900/60 overflow-hidden">
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-3 sm:px-4 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-start gap-2 text-left min-w-0 flex-1 cursor-pointer group"
            aria-expanded={!collapsed}
          >
            <span className="text-slate-500 mt-0.5 text-xs shrink-0 group-hover:text-slate-300">
              {collapsed ? '▸' : '▾'}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100">{section.title}</h2>
              {section.hint && (
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{section.hint}</p>
              )}
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sortKey}
                onChange={(e) => onSectionSortChange(e.target.value)}
                className="text-[11px] bg-slate-950 border border-slate-700 rounded-md px-1.5 py-1 text-slate-300 max-w-[7.5rem]"
                onClick={(e) => e.stopPropagation()}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {!collapsed && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] sm:text-xs">
            {stats.avg != null && (
              <span className="text-slate-400 tabular-nums">
                Avg session{' '}
                <span
                  className={
                    stats.avg > 0
                      ? 'text-emerald-400'
                      : stats.avg < 0
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }
                >
                  {formatChangePct(stats.avg)}
                </span>
              </span>
            )}
            <span className="text-slate-600">·</span>
            <span className="text-emerald-400/90 tabular-nums">{stats.up} up</span>
            <span className="text-red-400/90 tabular-nums">{stats.down} down</span>
            {stats.flat > 0 && (
              <span className="text-slate-500 tabular-nums">{stats.flat} flat</span>
            )}
            <span className="text-slate-600 hidden sm:inline">·</span>
            <MoverChip label="Top" it={movers.gainer} tone="up" />
            <MoverChip label="Low" it={movers.loser} tone="down" />
            <EtfBenchmarkChips etfBenchmarks={etfBenchmarks} />
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-2 sm:px-4 py-3 overflow-x-auto">
          <table className="w-full border-collapse min-w-[280px]">
            <thead>
              <tr className="text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="font-semibold pb-2 text-left">Company</th>
                <th className="font-semibold pb-2 text-right w-28 sm:w-36">Current</th>
                <th
                  className={`font-semibold pb-2 text-right w-28 sm:w-36 ${
                    columnMuted ? 'text-slate-600' : ''
                  }`}
                  title={extendedColumnTitle(extendedMode)}
                >
                  {extLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {sectionItems.map((it) => (
                <QuoteRow
                  key={it.name}
                  it={it}
                  extendedMode={extendedMode}
                  fxRate={fxRate}
                  compact={compact}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function WatchlistSections({ items, extendedMode, usdInr, etfBenchmarks }) {
  const [globalSort, setGlobalSort] = useState('default');
  const [sectionSortOverrides, setSectionSortOverrides] = useState({});
  const [compact, setCompact] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const showExtendedSortHint =
    extendedMode !== 'regular'
    && globalSort === 'default'
    && Object.keys(sectionSortOverrides).length === 0;

  const itemsBySymbol = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      map.set(String(it.name || '').trim().toUpperCase(), it);
    }
    return map;
  }, [items]);

  const fxRate = usdInr?.rate != null ? Number(usdInr.rate) : null;

  if (!items.length) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">Tap Refresh to load quotes.</p>
    );
  }

  function resolveSort(sectionId) {
    return sectionSortOverrides[sectionId] ?? globalSort;
  }

  return (
    <div className="space-y-4">
      {showExtendedSortHint && (
        <p className="text-[11px] text-violet-200/90 bg-violet-950/30 border border-violet-500/25 rounded-lg px-3 py-2 leading-snug">
          US pre/post session — extended hours are live. Sort by{' '}
          <button
            type="button"
            className="underline text-violet-100 font-semibold cursor-pointer"
            onClick={() => setGlobalSort('ext_desc')}
          >
            Pre/after ↓
          </button>{' '}
          or{' '}
          <button
            type="button"
            className="underline text-violet-100 font-semibold cursor-pointer"
            onClick={() => setGlobalSort('ext_asc')}
          >
            Pre/after ↑
          </button>{' '}
          to rank extended movers.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p
          className="text-[11px] text-slate-500 leading-snug max-w-xl"
          title="Grouped watchlists with per-section movers and sort. MRVL keeps INR hints and holdings."
        >
          Sections collapse independently · sticky headers · per-section sort overrides global
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>All sections</span>
            <select
              value={globalSort}
              onChange={(e) => {
                setGlobalSort(e.target.value);
                setSectionSortOverrides({});
              }}
              className={`text-[11px] bg-slate-950 border rounded-md px-2 py-1 text-slate-300 ${
                showExtendedSortHint
                  ? 'border-violet-500/50 ring-1 ring-violet-500/30'
                  : 'border-slate-700'
              }`}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setCompact((c) => !c)}
            className={`text-[11px] px-2.5 py-1 rounded-md border ${
              compact
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-100'
                : 'bg-slate-950 border-slate-700 text-slate-400'
            }`}
          >
            {compact ? 'Compact' : 'Detailed'}
          </button>
        </div>
      </div>

      {WATCHLIST_SECTIONS.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          itemsBySymbol={itemsBySymbol}
          extendedMode={extendedMode}
          fxRate={fxRate}
          sortKey={resolveSort(section.id)}
          compact={compact}
          collapsed={Boolean(collapsed[section.id])}
          onToggleCollapse={() =>
            setCollapsed((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
          }
          onSectionSortChange={(value) =>
            setSectionSortOverrides((prev) => ({ ...prev, [section.id]: value }))
          }
          etfBenchmarks={etfBenchmarks}
        />
      ))}
    </div>
  );
}
