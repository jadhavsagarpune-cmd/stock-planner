import { fetchWithTimeout, sleep, DEFAULT_UPSTREAM_TIMEOUT_MS } from './_fetchUtils.js';
import { fetchStooqQuoteMeta, stooqMetaFromSymbol } from './_stooqFallback.js';
import { mergeYahooExtendedFields } from './_mergeYahooExtended.js';

const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

export const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const CRUMB_TTL_MS = 55 * 60 * 1000;

let crumbCache = /** @type {{ crumb: string, cookie: string, at: number } | null} */ (null);

async function refreshYahooCrumb() {
  if (crumbCache && Date.now() - crumbCache.at < CRUMB_TTL_MS) return crumbCache;
  try {
    const fc = await fetchWithTimeout(
      'https://fc.yahoo.com/',
      { headers: UPSTREAM_HEADERS, redirect: 'manual' },
      7_000,
    );
    const rawCookies =
      typeof fc.headers.getSetCookie === 'function'
        ? fc.headers.getSetCookie()
        : [fc.headers.get('set-cookie')].filter(Boolean);
    const cookie = rawCookies.map((c) => String(c).split(';')[0]).filter(Boolean).join('; ');
    if (!cookie) return null;
    for (const host of YAHOO_HOSTS) {
      try {
        const crumbResp = await fetchWithTimeout(
          `https://${host}/v1/test/getcrumb`,
          { headers: { ...UPSTREAM_HEADERS, Cookie: cookie } },
          7_000,
        );
        if (!crumbResp.ok) continue;
        const crumb = (await crumbResp.text()).trim();
        if (crumb && !crumb.startsWith('<')) {
          crumbCache = { crumb, cookie, at: Date.now() };
          return crumbCache;
        }
      } catch {
        /* try next host */
      }
    }
  } catch {
    /* no crumb */
  }
  return null;
}

function appendCrumb(path, crumb) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}crumb=${encodeURIComponent(crumb)}`;
}

/**
 * Retry alternate Yahoo CDN host on 429/5xx; bounded timeout per attempt.
 * v7 quote endpoints get Yahoo crumb + session cookie when available.
 */
export async function yahooFetch(pathWithLeadingSlash, { timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS } = {}) {
  const path = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
  const needsCrumb = path.includes('/v7/') || path.includes('/v10/');
  const crumbPack = needsCrumb ? await refreshYahooCrumb() : null;

  let lastResp = null;
  let lastErr = null;
  for (const host of YAHOO_HOSTS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let urlPath = path;
      const headers = { ...UPSTREAM_HEADERS };
      if (crumbPack?.crumb && needsCrumb) {
        urlPath = appendCrumb(path, crumbPack.crumb);
        headers.Cookie = crumbPack.cookie;
      }
      try {
        const resp = await fetchWithTimeout(
          `https://${host}${urlPath}`,
          { headers },
          timeoutMs,
        );
        if (resp.ok) return resp;
        lastResp = resp;
        if (!RETRY_STATUSES.has(resp.status)) return resp;
        if (resp.status === 429 && attempt === 0) await sleep(400 + attempt * 350);
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await sleep(200);
      }
    }
  }
  if (lastResp) return lastResp;
  throw lastErr || new Error('Yahoo fetch failed');
}

/**
 * Chart v8 then v7, then Stooq CSV fallback — returns { kind: 'chart'|'stooq', payload }.
 */
export async function yahooChartOrFallback(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  const chartPath = `/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d&includePrePost=true`;
  try {
    const upstream = await yahooFetch(chartPath);
    if (upstream?.ok) {
      const payload = await upstream.json();
      const result = payload?.chart?.result?.[0];
      if (result?.meta?.regularMarketPrice != null || result?.meta?.previousClose != null) {
        return { kind: 'chart', payload };
      }
    }
  } catch {
    /* fall through */
  }
  const v7Path = `/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
  try {
    const v7 = await yahooFetch(v7Path);
    if (v7?.ok) {
      const v7Json = await v7.json();
      const row = v7Json?.quoteResponse?.result?.[0];
      if (row) {
        const payload = {
          chart: {
            result: [
              {
                meta: row,
                timestamp: [],
                indicators: { quote: [{ close: [], open: [], high: [], low: [], volume: [] }] },
              },
            ],
          },
          _source: 'yahoo_v7',
        };
        return { kind: 'chart', payload };
      }
    }
  } catch {
    /* fall through */
  }
  let stooqMeta = await fetchStooqQuoteMeta(sym);
  if (stooqMeta) {
    try {
      const v7 = await yahooFetch(v7Path);
      if (v7?.ok) {
        const v7Json = await v7.json();
        const row = v7Json?.quoteResponse?.result?.[0];
        if (row) stooqMeta = mergeYahooExtendedFields(stooqMeta, row);
      }
    } catch {
      /* Stooq-only */
    }
    return {
      kind: 'stooq',
      payload: {
        chart: {
          result: [
            {
              meta: stooqMeta,
              timestamp: [],
              indicators: { quote: [{ close: [], open: [], high: [], low: [], volume: [] }] },
            },
          ],
        },
        _source: 'stooq',
      },
    };
  }
  return null;
}

/** v7 multi-symbol batch (caller supplies comma-separated encoded symbols). */
export async function yahooQuoteBatch(pathWithSymbols) {
  return yahooFetch(pathWithSymbols);
}

export { fetchStooqQuoteMeta, stooqMetaFromSymbol };