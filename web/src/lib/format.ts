import { formatUnits, type Address } from "viem";

export function truncAddr(addr?: Address | string | null, n = 4): string {
  if (!addr) return "—";
  const s = addr.toString();
  return `${s.slice(0, 2 + n)}…${s.slice(-n)}`;
}

export function fmt(
  amount: bigint | undefined | null,
  decimals = 18,
  precision = 4,
): string {
  if (amount === undefined || amount === null) return "—";
  const s = formatUnits(amount, decimals);
  const [whole, frac = ""] = s.split(".");
  if (precision === 0) return whole;
  const trimmed = frac.slice(0, precision).replace(/0+$/, "");
  return trimmed.length > 0 ? `${whole}.${trimmed}` : whole;
}

export function fmtCompact(amount: bigint | undefined | null, decimals = 18): string {
  if (amount === undefined || amount === null) return "—";
  const n = Number(formatUnits(amount, decimals));
  // Use thresholds slightly below each boundary so values that round up across
  // the boundary (e.g. 999_995 → "1000.00K") get bumped to the next unit
  // ("1.00M") instead of looking weird.
  if (n >= 9.995e8) return (n / 1e9).toFixed(2) + "B";
  if (n >= 9.995e5) return (n / 1e6).toFixed(2) + "M";
  if (n >= 9.995e2) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

/// Format a plain JS number with K/M/B/T suffixes. Useful for display values that
/// are already number-typed (like the spot price calculated from sqrtPriceX96).
export function fmtCompactNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  // Same boundary-safe thresholds as fmtCompact.
  if (a >= 9.995e11) return (n / 1e12).toFixed(2) + "T";
  if (a >= 9.995e8) return (n / 1e9).toFixed(2) + "B";
  if (a >= 9.995e5) return (n / 1e6).toFixed(2) + "M";
  if (a >= 9.995e2) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export function fmtSeeds(seeds: bigint | undefined | null): string {
  if (seeds === undefined || seeds === null) return "—";
  // SEEDs are uint256 game counters, not 18-decimal token amounts.
  return seeds.toLocaleString();
}

export function fmtFee(feeRaw: number | bigint | undefined | null): string {
  if (feeRaw === undefined || feeRaw === null) return "—";
  const n = Number(feeRaw);
  // Fees are basis points × 100 in v4. 5000 = 0.5%, 10000 = 1%.
  return `${(n / 10_000).toFixed(2)}%`;
}
