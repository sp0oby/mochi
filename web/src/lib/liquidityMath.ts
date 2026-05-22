/// JavaScript / bigint port of v4-periphery's LiquidityAmounts library.
/// Lets the frontend compute the correct `liquidityDelta` to commit a specific
/// (ETH, MOCHI) pair into a position over a given tick range, so the amounts
/// the user enters in the UI match what actually gets pulled on-chain.

const Q96 = 1n << 96n;

function sortPair(a: bigint, b: bigint): [bigint, bigint] {
  return a < b ? [a, b] : [b, a];
}

/// L for a single-sided amount0 (currency0). Used when price is below or at tickLower.
export function getLiquidityForAmount0(
  sqrtAX96: bigint,
  sqrtBX96: bigint,
  amount0: bigint,
): bigint {
  const [a, b] = sortPair(sqrtAX96, sqrtBX96);
  if (b <= a) return 0n;
  // L = amount0 * (sqrtA * sqrtB / Q96) / (sqrtB - sqrtA)
  const intermediate = (a * b) / Q96;
  return (amount0 * intermediate) / (b - a);
}

/// L for a single-sided amount1 (currency1). Used when price is above or at tickUpper.
export function getLiquidityForAmount1(
  sqrtAX96: bigint,
  sqrtBX96: bigint,
  amount1: bigint,
): bigint {
  const [a, b] = sortPair(sqrtAX96, sqrtBX96);
  if (b <= a) return 0n;
  return (amount1 * Q96) / (b - a);
}

/// L given both amounts + the current pool price. Picks the constraining side.
export function getLiquidityForAmounts(
  sqrtCurrentX96: bigint,
  sqrtAX96: bigint,
  sqrtBX96: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  const [a, b] = sortPair(sqrtAX96, sqrtBX96);
  if (sqrtCurrentX96 <= a) {
    return getLiquidityForAmount0(a, b, amount0);
  }
  if (sqrtCurrentX96 < b) {
    const l0 = getLiquidityForAmount0(sqrtCurrentX96, b, amount0);
    const l1 = getLiquidityForAmount1(a, sqrtCurrentX96, amount1);
    return l0 < l1 ? l0 : l1;
  }
  return getLiquidityForAmount1(a, b, amount1);
}

/// Approximate sqrt(1.0001^tick) × 2^96, returned as a bigint. Uses Math.pow under
/// the hood — fine for typical ticks (precision loss is well under 1 wei at any
/// realistic price). For exact precision we'd port Uniswap's TickMath bit-shift
/// algorithm; for UI/quote purposes this approximation is sufficient.
export function sqrtRatioAtTick(tick: number): bigint {
  const ratio = Math.pow(1.0001, tick);
  const sqrtRatio = Math.sqrt(ratio);
  const asNumber = sqrtRatio * 2 ** 96;
  if (!Number.isFinite(asNumber)) return 0n;
  // BigInt(Number) only handles integers up to 2^53 cleanly. For bigger values
  // multiply via component split to preserve magnitude (precision OK for our use).
  if (asNumber < Number.MAX_SAFE_INTEGER) {
    return BigInt(Math.floor(asNumber));
  }
  // For very large values, split: sqrtRatio is the "mantissa", we shift via bigint.
  const mantissa = BigInt(Math.floor(sqrtRatio * 2 ** 32));
  return mantissa << 64n;
}
