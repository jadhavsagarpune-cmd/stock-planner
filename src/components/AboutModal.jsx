import { useEffect, useId } from 'react';

import { DEVELOPER } from '../lib/appInfo';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const SHA = typeof __APP_BUILD_SHA__ !== 'undefined' ? __APP_BUILD_SHA__ : 'dev';
const BUILT = typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : '—';

const SOURCES = [
  ['Yahoo Finance', 'Quotes, charts, news'],
  ['Stooq', 'Quote fallback'],
  ['Google News RSS', 'News fallback'],
];

export default function AboutModal({ open, onClose }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id={titleId} className="text-base font-semibold text-white">Stock planner</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-600"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Yahoo Finance semis / cloud / big-tech tracker with MRVL focus.
        </p>
        <dl className="mt-3 text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-slate-500">Version</dt>
          <dd className="text-slate-200 font-mono">{VERSION}</dd>
          <dt className="text-slate-500">Build</dt>
          <dd className="text-slate-200 font-mono">{SHA} · {BUILT}</dd>
        </dl>
        <h3 className="mt-4 mb-1 text-[11px] uppercase tracking-wide text-slate-500">Data sources</h3>
        <ul className="text-xs text-slate-300 space-y-0.5">
          {SOURCES.map(([n, d]) => (
            <li key={n}>{n} <span className="text-slate-500">· {d}</span></li>
          ))}
        </ul>
        <h3 className="mt-4 mb-1 text-[11px] uppercase tracking-wide text-slate-500">Developer</h3>
        <p className="text-xs text-slate-300">
          {DEVELOPER.name} ·{' '}
          <a href={`mailto:${DEVELOPER.email}`} className="text-violet-300 hover:underline">{DEVELOPER.email}</a>
        </p>
        <p className="mt-4 text-[11px] text-slate-500">
          Data may be delayed. Not financial advice.
        </p>
      </div>
    </div>
  );
}
