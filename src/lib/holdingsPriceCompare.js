/** @param {number|null} customPrice @param {number|null} liveUsd */
export function mrvlLiveVsCustomDelta(customPrice, liveUsd, { eps = 0.005 } = {}) {
  if (customPrice == null || liveUsd == null || !Number.isFinite(liveUsd) || liveUsd === 0) {
    return null;
  }
  const deltaUsd = customPrice - liveUsd;
  const deltaPct = (deltaUsd / liveUsd) * 100;
  const same = Math.abs(deltaUsd) < eps;
  return { deltaUsd, deltaPct, same };
}

/** Price used for INR/share math: custom overrides live. */
export function mrvlHoldingsValuationPrice(customPrice, liveUsd) {
  return customPrice ?? liveUsd ?? null;
}
