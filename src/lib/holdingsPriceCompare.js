/**
 * Live vs user entry (custom). Positive delta = live above entry (unrealized gain).
 * @param {number|null} customPrice entry / average (USD)
 * @param {number|null} liveUsd current quote (USD)
 */
export function mrvlLiveVsCustomDelta(customPrice, liveUsd, { eps = 0.005 } = {}) {
  if (customPrice == null || liveUsd == null || !Number.isFinite(liveUsd) || !Number.isFinite(customPrice) || customPrice === 0) {
    return null;
  }
  const deltaUsd = liveUsd - customPrice;
  const deltaPct = (deltaUsd / customPrice) * 100;
  const same = Math.abs(deltaUsd) < eps;
  return { deltaUsd, deltaPct, same };
}

/** Price used for INR/share math: custom overrides live. */
export function mrvlHoldingsValuationPrice(customPrice, liveUsd) {
  return customPrice ?? liveUsd ?? null;
}
