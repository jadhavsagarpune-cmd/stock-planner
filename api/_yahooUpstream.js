const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

export const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Retry alternate Yahoo CDN host on 429/5xx. */
export async function yahooFetch(pathWithLeadingSlash) {
  const path = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
  let lastResp = null;
  for (const host of YAHOO_HOSTS) {
    const resp = await fetch(`https://${host}${path}`, { headers: UPSTREAM_HEADERS });
    if (resp.ok) return resp;
    lastResp = resp;
    if (resp.status !== 429 && resp.status !== 500 && resp.status !== 502 && resp.status !== 503) {
      return resp;
    }
  }
  return lastResp;
}