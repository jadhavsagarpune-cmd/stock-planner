import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchNews } from './lib/news';
import { buildMoveMap, rankNews } from './lib/newsRank';
import NewsTicker from './components/NewsTicker';
import NewsPanel from './components/NewsPanel';
import AboutModal, { DEVELOPER } from './components/AboutModal';
import WatchlistSections from './components/WatchlistSections';
import SectorHeatmap from './components/SectorHeatmap';
import MrvlPriceChart from './components/MrvlPriceChart';
import MrvlHoldingsPanel from './components/MrvlHoldingsPanel';
import { clearLegacyMrvlSharesStorage } from './lib/holdingsStorage';
import {
  baselineNeedsDailyHistory,
  defaultHeatmapBaselineIdForClock,
  HEATMAP_BASELINE_STORAGE_KEY,
  heatmapBaselineUserPicked,
  loadHeatmapBaselineId,
  saveHeatmapBaselineId,
} from './lib/heatmapBaselines';
import { prefetchDailyBarsForSymbols } from './lib/historicalQuotes';
import {
  formatStaleCacheLabel,
  getLatestSnapshot,
  loadLastGoodQuote,
  loadLastGoodQuoteWithMeta,
  quoteFromSnapshot,
  recordQuoteSnapshots,
  saveLastGoodQuote,
} from './lib/priceHistoryStore';
import { formatQuoteFetchError, quoteIsRenderable } from './lib/quoteResilience';

const MRVL_POLL_MS = 60_000;
const EXTENDED_WATCHLIST_POLL_MS = 60_000;
const WATCHLIST_POLL_MS = 5 * 60_000;
const USD_INR_POLL_MS = 5 * 60_000;

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mrvl, setMrvl] = useState(() => {
    const cached = loadLastGoodQuote('MRVL');
    return quoteIsRenderable(cached) ? cached : null;
  });
  const [mrvlErr, setMrvlErr] = useState('');
  const [mrvlStaleLabel, setMrvlStaleLabel] = useState(() => {
    const meta = loadLastGoodQuoteWithMeta('MRVL');
    return meta?.savedAt ? formatStaleCacheLabel(meta.savedAt) : '';
  });
  const [usdInr, setUsdInr] = useState(null);
  const [usdInrErr, setUsdInrErr] = useState('');
  const [notifyOn, setNotifyOn] = useState(() => getDesktopNotificationsEnabled());
  const [lastRefresh, setLastRefresh] = useState(null);
  const [quotesBanner, setQuotesBanner] = useState('');
  const [holdingsOpen, setHoldingsOpen] = useState(false);
  const [etfBenchmarks, setEtfBenchmarks] = useState(null);
  const [heatmapBaseline, setHeatmapBaseline] = useState(() => loadHeatmapBaselineId());
  const [dailyBySymbol, setDailyBySymbol] = useState(() => new Map());

  const [news, setNews] = useState({ items: [], windowHours: 24, ok: true });
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const refreshNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      setNews(await fetchNews(ALL_WATCHLIST_ENTRIES.map(([, s]) => s)));
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const moves = useMemo(() => buildMoveMap(items, mrvl), [items, mrvl]);
  const rankedNews = useMemo(() => rankNews(news.items, moves), [news.items, moves]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setQuotesBanner('');
    try {
      const [list, etfs] = await Promise.all([
        fetchWatchlistQuotes(ALL_WATCHLIST_ENTRIES, setItems),
        fetchEtfBenchmarks(),
      ]);
      const failed = list.filter((i) => i.status === 'failed').length;
      const done = list.filter((i) => i.status === 'done').length;
      if (failed && done === 0) {
        setQuotesBanner('Live quotes unavailable (Yahoo may be rate-limiting). Retrying uses cache and Stooq fallback where possible.');
      } else if (failed > 0) {
        setQuotesBanner(`${failed} symbol(s) could not be refreshed — tiles show — until the next successful fetch.`);
      }
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
      if (!quoteIsRenderable(q)) throw new Error('No quote data');
      setMrvl(q);
      setMrvlErr('');
      setMrvlStaleLabel('');
      saveLastGoodQuote('MRVL', q);
      if (notifyOn) {
        notifyStockMoveIfNeeded({
          symbol: 'MRVL',
          label: 'Marvell (MRVL)',
          quote: q,
        });
      }
    } catch (e) {
      setMrvlErr(formatQuoteFetchError(e));
      let recovered = false;
      setMrvl((prev) => {
        if (quoteIsRenderable(prev)) {
          recovered = true;
          return prev;
        }
        const fromLsMeta = loadLastGoodQuoteWithMeta('MRVL');
        if (quoteIsRenderable(fromLsMeta?.quote)) {
          recovered = true;
          if (fromLsMeta.savedAt) setMrvlStaleLabel(formatStaleCacheLabel(fromLsMeta.savedAt));
          return fromLsMeta.quote;
        }
        return prev;
      });
      if (!recovered) {
        try {
          const snap = await getLatestSnapshot('MRVL');
          const fromIdb = quoteFromSnapshot(snap);
          if (quoteIsRenderable(fromIdb)) {
            setMrvl(fromIdb);
            setMrvlStaleLabel(formatStaleCacheLabel(snap?.ts));
          }
        } catch {
          /* IndexedDB optional */
        }
      }
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
    if (heatmapBaselineUserPicked()) return;
    const derived = defaultHeatmapBaselineIdForClock();
    if (derived !== heatmapBaseline) {
      setHeatmapBaseline(derived);
      try {
        localStorage.setItem(HEATMAP_BASELINE_STORAGE_KEY, derived);
      } catch {
        /* ignore */
      }
    }
  }, [heatmapBaseline]);

  useEffect(() => {
    refreshAll();
    refreshMrvl();
    refreshUsdInr();
  }, [refreshAll, refreshMrvl, refreshUsdInr]);

  useEffect(() => {
    void refreshNews(); // page load only; manual Refresh in panel (no polling)
  }, [refreshNews]);

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
      <header className="mb-3 sm:mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white">Stock planner</h1>
          <p className="text-xs text-slate-500 mt-1">Yahoo Finance · MRVL ±5% · others ±10%</p>
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
            onClick={() => setNewsOpen(true)}
            className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-600 hover:border-violet-500/40"
            aria-haspopup="dialog"
          >
            Top news
          </button>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-600 hover:border-violet-500/40"
            aria-haspopup="dialog"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => downloadWatchlistCsv(items)}
            disabled={!items.length || loading}
            className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-600 disabled:opacity-50"
            title="Download CSV"
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

      <NewsTicker items={rankedNews} moves={moves} loading={newsLoading} onOpen={() => setNewsOpen(true)} />

      {quotesBanner ? (
        <p className="text-[11px] text-amber-300/95 mb-2 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2" role="alert">
          {quotesBanner}
        </p>
      ) : null}

      {mrvlStaleLabel ? (
        <p className="text-[11px] text-amber-400/90 mb-2 -mt-1" role="status">
          MRVL quote is {mrvlStaleLabel} (live fetch failed).
        </p>
      ) : null}

      <MrvlPriceChart
        mrvl={mrvl}
        mrvlErr={mrvlErr}
        fxRate={fxRate}
        mrvlInrHint={mrvlInrHint}
        extMuted={extMuted}
        extLabel={extLabel}
        mrvlExt={mrvlExt}
        mrvlExtInrHint={mrvlExtInrHint}
        baselineId={heatmapBaseline}
        onBaselineChange={onHeatmapBaselineChange}
      />

      <div className="mb-4">
        <SectorHeatmap
          items={items}
          baselineId={heatmapBaseline}
          onBaselineChange={onHeatmapBaselineChange}
          dailyBySymbol={dailyBySymbol}
          extendedMode={extendedMode}
        />
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <div className="flex flex-col gap-2 px-3 sm:px-4 py-2 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
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
        </div>
        <div className="px-2 sm:px-4 py-3">
          <WatchlistSections
            items={items}
            extendedMode={extendedMode}
            usdInr={usdInr}
            etfBenchmarks={etfBenchmarks}
            baselineId={heatmapBaseline}
            onBaselineChange={onHeatmapBaselineChange}
            dailyBySymbol={dailyBySymbol}
          />
        </div>
      </section>

      <NewsPanel
        open={newsOpen}
        onClose={() => setNewsOpen(false)}
        items={rankedNews}
        moves={moves}
        loading={newsLoading}
        ok={news.ok}
        windowHours={news.windowHours}
        onRefresh={refreshNews}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <MrvlHoldingsPanel
        open={holdingsOpen}
        onClose={() => setHoldingsOpen(false)}
        mrvl={mrvl}
        usdInr={usdInr}
        usdInrErr={usdInrErr}
        baselineId={heatmapBaseline}
        extendedMode={extendedMode}
        onBaselineChange={onHeatmapBaselineChange}
        mrvlDaily={dailyBySymbol?.get('MRVL') ?? null}
      />

      <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
        Alerts need this tab open.
        <span className="block mt-1 text-slate-700 font-mono tabular-nums">
          Build {typeof __APP_BUILD_SHA__ !== 'undefined' ? __APP_BUILD_SHA__ : 'dev'}
          {' · '}
          <a href={`mailto:${DEVELOPER.email}`} className="hover:text-slate-400 underline-offset-2 hover:underline">
            Developer: {DEVELOPER.name} · {DEVELOPER.email}
          </a>
        </span>
      </p>
    </div>
  );
}
