/** Bounded upstream fetch — AbortController timeout for Vercel serverless. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 9_000;

export async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const ext = init.signal;
  if (ext) {
    if (ext.aborted) ctrl.abort();
    else ext.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}