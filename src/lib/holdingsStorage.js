const LEGACY_SHARES_KEY = 'stock-planner.mrvlShares';
const CUSTOM_USD_KEY = 'stock-planner.mrvlCustomUsd';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    if (value === '' || value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

/** One-time cleanup: shares are not persisted (sensitive). */
export function clearLegacyMrvlSharesStorage() {
  try {
    localStorage.removeItem(LEGACY_SHARES_KEY);
  } catch {
    /* ignore */
  }
}

export function loadMrvlCustomUsd() {
  return safeGet(CUSTOM_USD_KEY) ?? '';
}

export function saveMrvlCustomUsd(value) {
  safeSet(CUSTOM_USD_KEY, value);
}
