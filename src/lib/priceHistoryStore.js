const DB_NAME = 'stock-planner-price-history';
const DB_VERSION = 1;
const STORE_DAILY = 'daily_bars';
const STORE_SNAPSHOTS = 'snapshots';

const DAILY_TTL_MS = 4 * 60 * 60 * 1000;
const SNAPSHOT_MIN_GAP_MS = 55_000;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE_DAILY)) {
        db.createObjectStore(STORE_DAILY, { keyPath: 'symbol' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const snap = db.createObjectStore(STORE_SNAPSHOTS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        snap.createIndex('symbol_ts', ['symbol', 'ts'], { unique: false });
      }
    };
  });
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** @returns {Promise<{ symbol: string, updatedAt: number, bars: { t: number, close: number }[] } | null>} */
export async function getDailyBars(symbol) {
  const db = await openDb();
  if (!db) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DAILY, 'readonly');
    const req = tx.objectStore(STORE_DAILY).get(sym);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function isDailyCacheFresh(record) {
  if (!record?.updatedAt || !Array.isArray(record.bars) || !record.bars.length) return false;
  return Date.now() - record.updatedAt < DAILY_TTL_MS;
}

/** @param {string} symbol @param {{ t: number, close: number }[]} bars */
export async function putDailyBars(symbol, bars) {
  const db = await openDb();
  if (!db || !bars?.length) return;
  const sym = String(symbol || '').trim().toUpperCase();
  const tx = db.transaction(STORE_DAILY, 'readwrite');
  tx.objectStore(STORE_DAILY).put({
    symbol: sym,
    updatedAt: Date.now(),
    bars,
  });
  await txDone(tx);
}

/**
 * Append a quote snapshot (throttled per symbol).
 * @param {object} it — watchlist row with status done
 */
export async function recordQuoteSnapshot(it) {
  if (!it || it.status !== 'done') return;
  const db = await openDb();
  if (!db) return;
  const sym = String(it.name || '').trim().toUpperCase();
  const ts = Date.now();
  const price =
    it.current_price ?? it.fullday_price ?? it.regular_price ?? it.premarket_price ?? it.postmarket_price;
  if (price == null || Number.isNaN(Number(price))) return;

  const last = await getLatestSnapshot(sym);
  if (last && ts - last.ts < SNAPSHOT_MIN_GAP_MS) return;

  const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
  tx.objectStore(STORE_SNAPSHOTS).add({
    symbol: sym,
    ts,
    price: Number(price),
    regular_price: it.regular_price ?? null,
    previous_close: it.previous_close ?? null,
  });
  await txDone(tx);
}

async function getLatestSnapshot(symbol) {
  const db = await openDb();
  if (!db) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
    const idx = tx.objectStore(STORE_SNAPSHOTS).index('symbol_ts');
    const range = IDBKeyRange.bound([sym, 0], [sym, Date.now()]);
    const req = idx.openCursor(range, 'prev');
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Rolling capture for all done rows. */
export async function recordQuoteSnapshots(items) {
  if (!items?.length) return;
  await Promise.all(items.map((it) => recordQuoteSnapshot(it)));
}
