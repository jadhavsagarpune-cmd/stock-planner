import { useCallback, useEffect, useState } from 'react';
import { SEMICON_WATCHLIST } from './data/watchlist';
import { fetchMrvlQuote, fetchWatchlistQuotes } from './lib/quotes';
import { formatStockPrice, preChangePctVsRegular } from './lib/stockFormat';
import { shouldMutePreMarketColumn } from './lib/stockMarketSession';
import {
  getDesktopNotificationsEnabled,
  notifyStockMoveIfNeeded,
  requestNotificationPermission,
  setDesktopNotificationsEnabled,
} from './lib/stockPriceAlerts';
import SemiconductorQuotesTable from './components/SemiconductorQuotesTable';
import PriceChangeBadge from './components/PriceChangeBadge';

const MRVL_POLL_MS = 60_000;
const WATCHLIST_POLL_MS = 5 * 60_000;

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mrvl, setMrvl] = useState(null);
  const [mrvlErr, setMrvlErr] = useState('');
  const [notifyOn, setNotifyOn] = useState(() => getDesktopNotificationsEnabled());
  const [lastRefresh, setLastRefresh] = useState(null);

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

  useEffect(() => {
    refreshAll();
    refreshMrvl();
  }, [refreshAll, refreshMrvl]);

  useEffect(() => {
    const id = setInterval(refreshMrvl, MRVL_POLL_MS);
    return () => clearInterval(id);
  }, [refreshMrvl]);

  useEffect(() => {
    if (!notifyOn) return undefined;
    const id = setInterval(refreshAll, WATCHLIST_POLL_MS);
    return () => clearInterval(id);
  }, [notifyOn, refreshAll]);

  const preMuted = shouldMutePreMarketColumn(items.length ? items : mrvl?.market_state);
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
        <div className="flex flex-wrap gap-2">
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
              </span>
              <PriceChangeBadge pct={mrvl.regular_change_pct} className="ml-2" />
            </div>
            {!preMuted && mrvl.premarket_price != null && (
              <div>
                <span className="text-xs text-slate-500 block">Pre</span>
                <span className="font-mono text-violet-200 font-semibold tabular-nums">
                  {formatStockPrice(mrvl.premarket_price, mrvl.currency)}
                </span>
                <PriceChangeBadge
                  pct={preChangePctVsRegular(mrvl.premarket_price, mrvl.regular_price)}
                  className="ml-2"
                />
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
          <SemiconductorQuotesTable items={items} preColumnMuted={preMuted} />
        </div>
      </section>

      <p className="text-[11px] text-slate-600 mt-4 leading-relaxed">
        Alerts need this tab open (browser Notification API). iOS Safari limits background
        notifications; keep the PWA/home-screen tab foreground for reliable polling.
      </p>
    </div>
  );
}
