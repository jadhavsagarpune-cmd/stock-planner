import { WATCHLIST_SECTIONS } from '../data/watchlist';
import { formatChangePct } from './stockFormat';
import { sectionSummaryStats } from './watchlistAnalytics';

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function itemsBySymbol(items) {
  const map = new Map();
  for (const it of items) {
    map.set(String(it.name || '').trim().toUpperCase(), it);
  }
  return map;
}

/** Download CSV of quotes + per-section summary rows. */
export function downloadWatchlistCsv(items, { filename } = {}) {
  const bySym = itemsBySymbol(items);
  const lines = [];
  lines.push(
    [
      'section_id',
      'section_title',
      'symbol',
      'label',
      'status',
      'currency',
      'regular_price',
      'regular_change_pct',
      'premarket_price',
      'postmarket_price',
      'error',
    ].join(','),
  );

  for (const sec of WATCHLIST_SECTIONS) {
    for (const [label, symbol] of sec.entries) {
      const sym = String(symbol).trim().toUpperCase();
      const it = bySym.get(sym) || { name: sym, label, status: 'missing' };
      lines.push(
        [
          sec.id,
          sec.title,
          sym,
          it.label || label,
          it.status || '',
          it.currency || '',
          it.regular_price ?? '',
          it.regular_change_pct ?? '',
          it.premarket_price ?? '',
          it.postmarket_price ?? '',
          it.error || '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    const secItems = sec.entries.map(([label, sym]) => {
      const s = String(sym).trim().toUpperCase();
      return bySym.get(s) || { name: s, label, status: 'pending' };
    });
    const stats = sectionSummaryStats(secItems);
    lines.push(
      [
        sec.id,
        `${sec.title} (summary)`,
        '',
        '',
        '',
        '',
        '',
        stats.avg != null ? formatChangePct(stats.avg)?.replace(/[+%−]/g, '') : '',
        `up:${stats.up}`,
        `down:${stats.down}`,
        `quoted:${stats.quoted}/${stats.total}`,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = filename || `stock-planner-watchlist-${stamp}.csv`;
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
