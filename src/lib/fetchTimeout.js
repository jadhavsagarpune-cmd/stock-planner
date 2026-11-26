export const CLIENT_FETCH_TIMEOUT_MS = 12_000;

export function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), ms);
  const clear = () => clearTimeout(timer);
  return { signal: ctrl.signal, clear };
}

export function mergeAbortSignals(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.aborted || b.aborted) {
    const ctrl = new AbortController();
    ctrl.abort();
    return ctrl.signal;
  }
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  return ctrl.signal;
}

export function clientFetchTimeout(ms = CLIENT_FETCH_TIMEOUT_MS) {
  return abortAfter(ms);
}