import { useGardenCurve } from "../hooks/useGardenCurve";
import { usePoolMetrics } from "../hooks/usePoolMetrics";
import { Sticker } from "./Primitives";

/// Surfaces a warning when the garden curve price and the pool spot price drift
/// far apart, which would create an arbitrage opportunity (and bad UX for whichever
/// side has worse exit liquidity).
export function PriceMismatchBanner() {
  const { currentPrice } = useGardenCurve();
  const { sqrtPriceX96 } = usePoolMetrics();

  if (currentPrice === undefined || sqrtPriceX96 === undefined) return null;

  // currentPrice is wei of ETH per 1 MOCHI token.
  const curveEthPerMochi = Number(currentPrice) / 1e18;
  // sqrtPriceX96 = sqrt(MOCHI/ETH ratio) × 2^96.
  const sp = Number(sqrtPriceX96) / 2 ** 96;
  const poolMochiPerEth = sp * sp;
  if (!poolMochiPerEth || !curveEthPerMochi) return null;
  const poolEthPerMochi = 1 / poolMochiPerEth;

  const ratio =
    Math.max(curveEthPerMochi, poolEthPerMochi) /
    Math.min(curveEthPerMochi, poolEthPerMochi);

  if (ratio < 2) return null;

  const curveCheaper = curveEthPerMochi < poolEthPerMochi;

  return (
    <div className="mx-auto my-3 max-w-[1100px] rounded-md border-2 border-dashed border-pink-500 bg-pink-50 px-4 py-2 text-center text-sm text-pink-500">
      <Sticker tone="pink" rotate={-4}>
        heads up ✦
      </Sticker>{" "}
      curve and pool prices are{" "}
      <span className="font-display">{ratio.toFixed(1)}×</span> apart.{" "}
      {curveCheaper
        ? "minting from the curve is much cheaper than the pool — arbitragers will fix this if there's enough liquidity ~"
        : "the pool is cheaper than the curve — most people will skip minting and just buy on the pool until arb closes the gap ~"}
    </div>
  );
}
