import { useCallback, useEffect, useState } from 'react';
import { SEMICON_WATCHLIST } from './data/watchlist';
import { fetchMrvlQuote, fetchUsdInrRate, fetchWatchlistQuotes } from './lib/quotes';
import { formatMrvlInrHint, formatStockPrice, pickExtendedQuote } from './lib/stockFormat';
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
import SemiconductorQuotesTable from './components/SemiconductorQuotesTable';
import PriceChangeBadge from './components/PriceChangeBadge';
import MrvlHoldingsPanel from './components/MrvlHoldingsPanel';
import { clearLegacyMrvlSharesStorage } from './lib/holdingsStorage';

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

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchWatchlistQuotes(SEMICON_WATCHLIST, setItems);
      setLastRefresh(new Date());
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
  }, [notifyOn]);

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
  const mrvlInrHint =
    mrvl?.regular_price != null && fxRate != null
      ? formatMrvlInrHint(mrvl.regular_price, fxRate)
      : null;
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
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-white">Semiconductor planner</h1>
          <p className="text-xs text-slate-500 mt-1">
            Yahoo Finance · MRVL ±5% · watchlist ±10% · Samsung/Hynix = KRX (KRW)
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

      <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900/80 p-3 sm:p-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Marvell (MRVL)</div>
        {mrvlErr ? (
          <p className="text-sm text-amber-300">{mrvlErr}</p>
        ) : mrvl ? (
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            <div>
              <span className="text-xs text-slate-500 block">Current</span>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatStockPrice(mrvl.regular_price, mrvl.currency)}
                {mrvlInrHint && (
                  <span className="text-sm font-normal text-violet-300/90 ml-1.5">
                    ({mrvlInrHint})
                  </span>
                )}
              </span>
              <PriceChangeBadge pct={mrvl.regular_change_pct} className="ml-2" />
            </div>
            {!extMuted && mrvlExt?.price != null && (
              <div>
                <span className="text-xs text-slate-500 block">{extLabel}</span>
                <span className="font-mono text-violet-200 font-semibold tabular-nums">
                  {formatStockPrice(mrvlExt.price, mrvl.currency)}
                  {mrvlExtInrHint && (
                    <span className="text-sm font-normal text-violet-300/80 ml-1.5">
                      ({mrvlExtInrHint})
                    </span>
                  )}
                </span>
                <PriceChangeBadge pct={mrvlExt.pct} className="ml-2" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading MRVL…</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-800">
          <span className="text-sm font-medium text-slate-200">Watchlist</span>
          <span className="text-xs text-slate-500 tabular-nums">
            {doneCount}/{items.length || SEMICON_WATCHLIST.length}
            {lastRefresh && (
              <span className="hidden sm:inline ml-2">
                · {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </span>
        </div>
        <div className="px-2 sm:px-4 py-3">
          <SemiconductorQuotesTable items={items} extendedMode={extendedMode} usdInr={usdInr} />
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
