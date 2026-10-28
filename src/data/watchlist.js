/** Same list as backend/services/stock_watchlist.py SEMICON_WATCHLIST */
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
];

/** Yahoo ticker → human exchange hint for UI */
export function exchangeHint(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (sym.endsWith('.KS')) return 'KRX · KRW';
  return 'US listing · USD';
}
