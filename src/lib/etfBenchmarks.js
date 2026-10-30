import { formatChangePct } from './stockFormat';
import { fetchYahooQuote } from './quotes';

export const ETF_BENCHMARKS = [
  { symbol: 'SOXX', label: 'SOXX' },
  { symbol: 'SMH', label: 'SMH' },
  { symbol: 'QQQ', label: 'QQQ' },
];

/** Parallel fetch session % change for benchmark ETFs. */
export async function fetchEtfBenchmarks({ signal } = {}) {
  const out = {};
  await Promise.all(
    ETF_BENCHMARKS.map(async ({ symbol }) => {
      try {
        const q = await fetchYahooQuote(symbol, { signal });
        out[symbol] = {
          symbol,
          regular_change_pct: q.regular_change_pct ?? null,
          regular_price: q.regular_price ?? null,
        };
      } catch {
        out[symbol] = { symbol, regular_change_pct: null, regular_price: null };
      }
    }),
  );
  return out;
}

export function formatEtfChipPct(pct) {
  const label = formatChangePct(pct);
  if (!label) return '—';
  return label;
}

export function etfPctColorClass(pct) {
  const n = Number(pct);
  if (Number.isNaN(n) || pct == null) return 'text-slate-500';
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-slate-400';
}
