/** Semiconductor peers — synced conceptually with backend/services/stock_watchlist.py (ILM semicon list). */
export const SEMICON_WATCHLIST = [
  ['NVIDIA (NVDA)', 'NVDA'],
  ['TSMC (TSM)', 'TSM'],
  ['Broadcom (AVGO)', 'AVGO'],
  ['Samsung Electronics (005930.KS)', '005930.KS'],
  ['ASML (ASML)', 'ASML'],
  ['AMD (AMD)', 'AMD'],
  ['SK Hynix (000660.KS)', '000660.KS'],
  ['Micron (MU)', 'MU'],
  ['Applied Materials (AMAT)', 'AMAT'],
  ['Lam Research (LRCX)', 'LRCX'],
  ['Qualcomm (QCOM)', 'QCOM'],
  ['Intel (INTC)', 'INTC'],
  ['KLA (KLAC)', 'KLAC'],
  ['Texas Instruments (TXN)', 'TXN'],
  ['Arm Holdings (ARM)', 'ARM'],
  ['Analog Devices (ADI)', 'ADI'],
  ['Marvell Technology (MRVL)', 'MRVL'],
  ['Credo Technology (CRDO)', 'CRDO'],
  ['Astera Labs (ALAB)', 'ALAB'],
  ['Monolithic Power Systems (MPWR)', 'MPWR'],
  ['NXP Semiconductors (NXPI)', 'NXPI'],
  ['Microchip Technology (MCHP)', 'MCHP'],
  ['ON Semiconductor (ON)', 'ON'],
  ['GlobalFoundries (GFS)', 'GFS'],
  ['Lumentum (LITE)', 'LITE'],
  ['Coherent (COHR)', 'COHR'],
];

/** Grouped watchlist for the stock-planner UI (extends ILM semicon-only backend list). */
export const WATCHLIST_SECTIONS = [
  {
    id: 'semiconductors',
    title: 'Semiconductors',
    hint: 'Chip & semi equipment · KRX names in KRW',
    entries: SEMICON_WATCHLIST,
  },
  {
    id: 'hyperscalers',
    title: 'Hyperscalers & cloud',
    hint: 'Mega-cap cloud / AI infra spend',
    entries: [
      ['Alphabet (GOOGL)', 'GOOGL'],
      ['Amazon (AMZN)', 'AMZN'],
      ['Meta Platforms (META)', 'META'],
      ['Microsoft (MSFT)', 'MSFT'],
      ['Oracle (ORCL)', 'ORCL'],
      ['Salesforce (CRM)', 'CRM'],
    ],
  },
  {
    id: 'big_tech',
    title: 'Big tech & platforms',
    hint: 'Consumer / enterprise software & media',
    entries: [
      ['Apple (AAPL)', 'AAPL'],
      ['Netflix (NFLX)', 'NFLX'],
      ['Adobe (ADBE)', 'ADBE'],
      ['ServiceNow (NOW)', 'NOW'],
      ['Uber (UBER)', 'UBER'],
      ['Shopify (SHOP)', 'SHOP'],
      ['PayPal (PYPL)', 'PYPL'],
    ],
  },
];

/** Flat [label, symbol] pairs for quote fetch (deduped by symbol, section order preserved). */
export function flattenWatchlistEntries(sections = WATCHLIST_SECTIONS) {
  const seen = new Set();
  const out = [];
  for (const sec of sections) {
    for (const pair of sec.entries) {
      const sym = String(pair[1] || '').trim().toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      out.push(pair);
    }
  }
  return out;
}

export const ALL_WATCHLIST_ENTRIES = flattenWatchlistEntries();

/** Yahoo ticker → human exchange hint for UI */
export function exchangeHint(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (sym.endsWith('.KS')) return 'KRX · KRW';
  return 'US listing · USD';
}
