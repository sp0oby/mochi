/// Minimal v4 / v3-style swap output estimator (zero hop, no fees).
/// Uses the standard Uniswap concentrated-liquidity math.
/// All math in bigint to avoid precision loss.

const Q96 = 1n << 96n;

/// Estimate the amount of currency1 received for `amountIn` of currency0 (ETH → MOCHI).
/// Ignores fees and assumes the swap stays within the current tick's liquidity bucket.
/// For huge swaps that cross many ticks, this will overestimate the output.
export function estimateAmountOut0For1(
  amountIn: bigint,
  sqrtPriceX96: bigint,
  liquidity: bigint,
): bigint {
  if (liquidity === 0n || amountIn === 0n || sqrtPriceX96 === 0n) return 0n;
  // For zeroForOne (token0 in, token1 out):
  //   newSqrtP = L * sqrtP / (L + amountIn * sqrtP / 2^96)
  //   amountOut1 = L * (oldSqrtP - newSqrtP) / 2^96
  const numerator = liquidity * Q96;
  const denominator = liquidity + (amountIn * sqrtPriceX96) / Q96;
  if (denominator === 0n) return 0n;
  const newSqrtP = (numerator * sqrtPriceX96) / (denominator * Q96);
  if (newSqrtP >= sqrtPriceX96) return 0n;
  return (liquidity * (sqrtPriceX96 - newSqrtP)) / Q96;
}

/// Estimate amount0 (ETH) received for `amountIn` of currency1 (MOCHI → ETH).
export function estimateAmountOut1For0(
  amountIn: bigint,
  sqrtPriceX96: bigint,
  liquidity: bigint,
): bigint {
  if (liquidity === 0n || amountIn === 0n || sqrtPriceX96 === 0n) return 0n;
  // For oneForZero (token1 in, token0 out):
  //   newSqrtP = sqrtP + (amountIn * 2^96 / L)
  //   amountOut0 = L * (newSqrtP - oldSqrtP) / (newSqrtP * oldSqrtP / 2^96)
  const newSqrtP = sqrtPriceX96 + (amountIn * Q96) / liquidity;
  if (newSqrtP <= sqrtPriceX96) return 0n;
  const numerator = liquidity * (newSqrtP - sqrtPriceX96) * Q96;
  const denom = newSqrtP * sqrtPriceX96;
  if (denom === 0n) return 0n;
  return numerator / denom;
}

/// Apply a fee in basis points (× 10_000). Returns amountOut after fee.
export function applyFee(amountOut: bigint, feeRaw: number | undefined): bigint {
  if (!feeRaw || feeRaw === 0) return amountOut;
  // feeRaw is in v4's hundredths-of-bps: 5000 = 0.5%, 10000 = 1%, max 1_000_000 = 100%
  const feeBigint = BigInt(feeRaw);
  return amountOut - (amountOut * feeBigint) / 1_000_000n;
}
