import { clientFetchTimeout } from './fetchTimeout';

/** Absolute http(s) URL or null. */
export function safeHttpUrl(u) {
  try {
    const x = new URL(String(u || '').trim());
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null;
  } catch {
    return null;
  }
}

/** Fetch top news; never throws or hangs. Returns { items, windowHours, ok }. */
export async function fetchNews(symbols = [], timeoutMs = 25_000) {
  const { signal, clear } = clientFetchTimeout(timeoutMs);
  try {
    const q = symbols.length ? `?symbols=${encodeURIComponent(symbols.join(','))}` : '';
    const r = await fetch(`/api/news${q}`, { signal });
    if (!r.ok) return { items: [], windowHours: 24, ok: false };
    const j = await r.json();
    return {
      items: (Array.isArray(j?.items) ? j.items : [])
        .map((i) => ({ ...i, url: safeHttpUrl(i?.url) }))
        .filter((i) => i.url && i.title),
      windowHours: Number(j?.windowHours) || 24,
      summaries: !!j?.summaries,
      ok: true,
    };
  } catch {
    return { items: [], windowHours: 24, ok: false };
  } finally {
    clear();
  }
}
