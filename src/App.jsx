import { useCallback, useEffect, useState } from 'react';
import { ALL_WATCHLIST_ENTRIES } from './data/watchlist';
import { fetchMrvlQuote, fetchUsdInrRate, fetchWatchlistQuotes } from './lib/quotes';
import { fetchEtfBenchmarks } from './lib/etfBenchmarks';
import { downloadWatchlistCsv } from './lib/exportWatchlistCsv';
import { formatMrvlInrHint, pickExtendedQuote } from './lib/stockFormat';
import { pickActiveSessionPrice } from './lib/sessionQuote';
import {
  extendedColumnLabel,
  isExtendedColumnMuted,
  resolveUsExtendedColumnMode,
} from './lib/stockMarketSession';
import {
  getDesktopNotificationsEnabled,
  notifyStockMoveIfNeeded,
  requestNotificationPermission,
  setDesktopNotificationsEnabled,
} from './lib/stockPriceAlerts';
import WatchlistSections from './components/WatchlistSections';
import SectorHeatmap from './components/SectorHeatmap';
import MrvlPriceChart from './components/MrvlPriceChart';
import MrvlHoldingsPanel from './components/MrvlHoldingsPanel';
import { clearLegacyMrvlSharesStorage } from './lib/holdingsStorage';
import {
  baselineNeedsDailyHistory,
  loadHeatmapBaselineId,
  saveHeatmapBaselineId,
} from './lib/heatmapBaselines';
import { prefetchDailyBarsForSymbols } from './lib/historicalQuotes';
import { recordQuoteSnapshots } from './lib/priceHistoryStore';

const MRVL_POLL_MS = 60_000;
const EXTENDED_WATCHLIST_POLL_MS = 60_000;
const WATCHLIST_POLL_MS = 5 * 60_000;
const USD_INR_POLL_MS = 5 * 60_000;

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mrvl, setMrvl] = useState(null);
  const [mrvlErr, setMrvlErr] = useState('');
  const [usdInr, setUsdInr] = useState(null);
  const [usdInrErr, setUsdInrErr] = useState('');
  const [notifyOn, setNotifyOn] = useState(() => getDesktopNotificationsEnabled());
  const [lastRefresh, setLastRefresh] = useState(null);
  const [holdingsOpen, setHoldingsOpen] = useState(false);
  const [etfBenchmarks, setEtfBenchmarks] = useState(null);
  const [heatmapBaseline, setHeatmapBaseline] = useState(() => loadHeatmapBaselineId());
  const [dailyBySymbol, setDailyBySymbol] = useState(() => new Map());

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, etfs] = await Promise.all([
        fetchWatchlistQuotes(ALL_WATCHLIST_ENTRIES, setItems),
        fetchEtfBenchmarks(),
      ]);
      setEtfBenchmarks(etfs);
      setLastRefresh(new Date());
      void recordQuoteSnapshots(list);
      const symbols = ALL_WATCHLIST_ENTRIES.map(([, s]) => s);
      if (baselineNeedsDailyHistory(heatmapBaseline)) {
        void prefetchDailyBarsForSymbols(symbols, { onProgress: setDailyBySymbol });
      }
      if (notifyOn) {
        for (const it of list) {
          if (it.status !== 'done') continue;
          notifyStockMoveIfNeeded({
            symbol: it.name,
            label: it.label,
            quote: it,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [notifyOn, heatmapBaseline]);

  const refreshMrvl = useCallback(async () => {
    try {
      const q = await fetchMrvlQuote();
      setMrvl(q);
      setMrvlErr('');
      if (notifyOn) {
        notifyStockMoveIfNeeded({
          symbol: 'MRVL',
          label: 'Marvell (MRVL)',
          quote: q,
        });
      }
    } catch (e) {
      setMrvlErr(e.message || 'Quote failed');
    }
  }, [notifyOn]);

  const refreshUsdInr = useCallback(async () => {
    try {
      const fx = await fetchUsdInrRate();
      setUsdInr(fx);
      setUsdInrErr('');
    } catch (e) {
      setUsdInrErr(e.message || 'FX failed');
    }
  }, []);

  useEffect(() => {
    clearLegacyMrvlSharesStorage();
  }, []);

  useEffect(() => {
    const symbols = ALL_WATCHLIST_ENTRIES.map(([, s]) => s);
    void prefetchDailyBarsForSymbols(symbols, { onProgress: setDailyBySymbol });
  }, []);

  useEffect(() => {
    if (!baselineNeedsDailyHistory(heatmapBaseline)) return;
    const symbols = ALL_WATCHLIST_ENTRIES.map(([, s]) => s);
    void prefetchDailyBarsForSymbols(symbols, { onProgress: setDailyBySymbol });
  }, [heatmapBaseline]);

  const onHeatmapBaselineChange = useCallback((id) => {
    saveHeatmapBaselineId(id);
    setHeatmapBaseline(id);
  }, []);

  useEffect(() => {
    refreshAll();
    refreshMrvl();
    refreshUsdInr();
  }, [refreshAll, refreshMrvl, refreshUsdInr]);

  useEffect(() => {
    const id = setInterval(refreshMrvl, MRVL_POLL_MS);
    return () => clearInterval(id);
  }, [refreshMrvl]);

  useEffect(() => {
    const id = setInterval(refreshUsdInr, USD_INR_POLL_MS);
    return () => clearInterval(id);
  }, [refreshUsdInr]);

  useEffect(() => {
    if (!notifyOn) return undefined;
    const id = setInterval(refreshAll, WATCHLIST_POLL_MS);
    return () => clearInterval(id);
  }, [notifyOn, refreshAll]);

  const extendedMode = resolveUsExtendedColumnMode(items.length ? items : mrvl?.market_state);

  useEffect(() => {
    if (extendedMode === 'regular') return undefined;
    const id = setInterval(refreshAll, EXTENDED_WATCHLIST_POLL_MS);
    return () => clearInterval(id);
  }, [extendedMode, refreshAll]);
  const extMuted = isExtendedColumnMuted(extendedMode);
  const extLabel = extendedColumnLabel(extendedMode);
  const mrvlExt = pickExtendedQuote(mrvl, extendedMode);
  const fxRate = usdInr?.rate != null ? Number(usdInr.rate) : null;
  const mrvlHeadlineUsd = mrvl ? pickActiveSessionPrice(mrvl) : null;
  const mrvlInrHint =
    mrvlHeadlineUsd != null && fxRate != null ? formatMrvlInrHint(mrvlHeadlineUsd, fxRate) : null;
  const mrvlExtInrHint =
    mrvlExt?.price != null && fxRate != null ? formatMrvlInrHint(mrvlExt.price, fxRate) : null;
  const fxTime = usdInr?.fetched_at
    ? new Date(usdInr.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const doneCount = items.filter((i) => i.status === 'done' || i.status === 'failed').length;

  async function toggleNotify() {
    if (!notifyOn) {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') return;
      setDesktopNotificationsEnabled(true);
      setNotifyOn(true);
    } else {
      setDesktopNotificationsEnabled(false);
      setNotifyOn(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-8 safe-area-pb">
      <MrvlPriceChart
        mrvl={mrvl}
        mrvlErr={mrvlErr}
        fxRate={fxRate}
        mrvlInrHint={mrvlInrHint}
        extMuted={extMuted}
        extLabel={extLabel}
        mrvlExt={mrvlExt}
        mrvlExtInrHint={mrvlExtInrHint}
      />

      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white">Stock planner</h1>
          <p className="text-xs text-slate-500 mt-1">
            Yahoo Finance · semicon + cloud + big tech · MRVL ±5% · others ±10% · KRX in KRW
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setHoldingsOpen(true)}
            className="text-xs px-2.5 py-2 rounded-lg bg-slate-950/70 border border-slate-600/50 text-slate-300 tabular-nums hover:border-violet-500/40 hover:bg-slate-900/90 transition-colors cursor-pointer"
            title={
              usdInrErr ||
              `USD/INR spot · click for MRVL INR holdings${fxTime ? ` · ${fxTime}` : ''}`
            }
            aria-expanded={holdingsOpen}
            aria-haspopup="dialog"
          >
            <span className="text-[10px] text-slate-500 uppercase tracking-wide mr-1">USD/INR</span>
            <span className="font-mono font-semibold">
              {usdInr?.rate != null ? Number(usdInr.rate).toFixed(2) : usdInrErr ? '—' : '…'}
            </span>
            {fxTime && (
              <span className="text-[10px] text-slate-600 ml-1 hidden sm:inline">{fxTime}</span>
            )}
            <span className="text-[10px] text-violet-400/80 ml-1.5 hidden sm:inline">₹ calc</span>
          </button>
          <button
            type="button"
            onClick={() => downloadWatchlistCsv(items)}
            disabled={!items.length || loading}
            className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-600 disabled:opacity-50"
            title="Download CSV of quotes and section summaries"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="text-xs px-3 py-2 rounded-lg bg-violet-600/30 text-violet-100 border border-violet-500/40 disabled:opacity-50"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          <button
            type="button"
            onClick={toggleNotify}
            className={`text-xs px-3 py-2 rounded-lg border ${
              notifyOn
                ? 'bg-emerald-600/20 text-emerald-200 border-emerald-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-600'
            }`}
          >
            {notifyOn ? 'Alerts on' : 'Enable alerts'}
          </button>
        </div>
      </header>

      <div className="mb-4">
        <SectorHeatmap
          items={items}
          baselineId={heatmapBaseline}
          onBaselineChange={onHeatmapBaselineChange}
          dailyBySymbol={dailyBySymbol}
        />
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-800">
          <span className="text-sm font-medium text-slate-200">Watchlists</span>
          <span className="text-xs text-slate-500 tabular-nums">
            {doneCount}/{items.length || ALL_WATCHLIST_ENTRIES.length}
            {lastRefresh && (
              <span className="hidden sm:inline ml-2">
                · {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </span>
        </div>
        <div className="px-2 sm:px-4 py-3">
          <WatchlistSections
            items={items}
            extendedMode={extendedMode}
            usdInr={usdInr}
            etfBenchmarks={etfBenchmarks}
          />
        </div>
      </section>

      <MrvlHoldingsPanel
        open={holdingsOpen}
        onClose={() => setHoldingsOpen(false)}
        mrvl={mrvl}
        usdInr={usdInr}
        usdInrErr={usdInrErr}
      />

      <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
        Alerts need this tab open (browser Notification API). iOS Safari limits background
        notifications; keep the PWA/home-screen tab foreground for reliable polling.
      </p>
    </div>
  );
}
