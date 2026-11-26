const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

export const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Retry alternate Yahoo CDN host on 429/5xx and transient network errors. */
export async function yahooFetch(pathWithLeadingSlash) {
  const path = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
  let lastResp = null;
  let lastErr = null;
  for (const host of YAHOO_HOSTS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const resp = await fetch(`https://${host}${path}`, { headers: UPSTREAM_HEADERS });
        if (resp.ok) return resp;
        lastResp = resp;
        if (!RETRY_STATUSES.has(resp.status)) return resp;
      } catch (err) {
        lastErr = err;
      }
      if (attempt === 0) await sleep(180);
    }
  }
  if (lastResp) return lastResp;
  throw lastErr || new Error('Yahoo fetch failed');
}