import { useEffect, useId, useMemo, useState } from 'react';
import { formatStockPrice, formatInr } from '../lib/stockFormat';
import {
  loadMrvlCustomUsd,
  loadMrvlShares,
  saveMrvlCustomUsd,
  saveMrvlShares,
} from '../lib/holdingsStorage';

function parsePositiveNumber(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export default function MrvlHoldingsPanel({ open, onClose, mrvl, usdInr, usdInrErr }) {
  const titleId = useId();
  const [shares, setShares] = useState(() => loadMrvlShares());
  const [customUsd, setCustomUsd] = useState(() => loadMrvlCustomUsd());

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    saveMrvlShares(shares);
  }, [shares]);

  useEffect(() => {
    saveMrvlCustomUsd(customUsd);
  }, [customUsd]);

  const shareCount = parsePositiveNumber(shares);
  const customPrice = parsePositiveNumber(customUsd);
  const liveUsd = mrvl?.regular_price != null ? Number(mrvl.regular_price) : null;
  const priceUsd = customPrice ?? liveUsd;
  const fxRate = usdInr?.rate != null ? Number(usdInr.rate) : null;
  const fxTime = usdInr?.fetched_at
    ? new Date(usdInr.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const { usdTotal, inrTotal } = useMemo(() => {
    if (shareCount == null || shareCount === 0 || priceUsd == null) {
      return { usdTotal: null, inrTotal: null };
    }
    const usd = shareCount * priceUsd;
    if (fxRate == null) return { usdTotal: usd, inrTotal: null };
    return { usdTotal: usd, inrTotal: usd * fxRate };
  }, [shareCount, priceUsd, fxRate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        aria-label="Close holdings calculator"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-xl border border-slate-600/60 bg-slate-900 shadow-xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-800">
          <div>
            <h2 id={titleId} className="text-sm font-semibold text-white">
              MRVL holdings (INR)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live MRVL × shares × USD/INR spot
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="rounded-lg bg-slate-950/60 border border-slate-700/50 px-3 py-2 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between gap-2">
              <span>USD/INR used</span>
              <span className="font-mono tabular-nums text-slate-200">
                {fxRate != null ? fxRate.toFixed(4) : usdInrErr ? '—' : '…'}
                {fxTime && (
                  <span className="text-slate-600 ml-1 font-sans">({fxTime})</span>
                )}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>MRVL price (USD)</span>
              <span className="font-mono tabular-nums text-slate-200">
                {customPrice != null ? (
                  <>
                    {formatStockPrice(customPrice, 'USD')}
                    <span className="text-violet-300/90 ml-1 font-sans text-[10px]">custom</span>
                  </>
                ) : liveUsd != null ? (
                  formatStockPrice(liveUsd, mrvl?.currency || 'USD')
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-slate-400">Shares</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="e.g. 100"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-mono tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-400">Custom price (USD, optional)</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={customUsd}
              onChange={(e) => setCustomUsd(e.target.value)}
              placeholder={liveUsd != null ? `Live ${liveUsd.toFixed(2)}` : 'Override share price'}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-mono tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </label>

          <div className="rounded-lg border border-violet-500/30 bg-violet-950/30 px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-violet-300/80 mb-1">
              INR total
            </div>
            <div className="font-mono text-xl font-semibold tabular-nums text-violet-100">
              {inrTotal != null ? formatInr(inrTotal) : '—'}
            </div>
            {usdTotal != null && (
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                ≈ {formatStockPrice(usdTotal, 'USD')} USD
              </div>
            )}
            {shareCount != null && shareCount > 0 && priceUsd == null && (
              <p className="text-[11px] text-amber-300/90 mt-2">Waiting for MRVL quote…</p>
            )}
            {shareCount != null && shareCount > 0 && priceUsd != null && fxRate == null && (
              <p className="text-[11px] text-amber-300/90 mt-2">
                {usdInrErr || 'Waiting for USD/INR…'}
              </p>
            )}
          </div>
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full text-xs py-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700/80"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
