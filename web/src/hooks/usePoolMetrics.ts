import { useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";

export function usePoolMetrics() {
  const { deployment } = useMochi();
  const enabled = !!deployment;

  const { data, refetch, isLoading } = useReadContracts({
    contracts: enabled
      ? [
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "poolState",
          },
          // PoolManager's MOCHI balance approximates the pool's MOCHI reserves
          // (since this PoolManager only hosts our one pool on Anvil).
          {
            address: deployment!.mochi,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [deployment!.poolManager],
          },
        ]
      : [],
    query: {
      enabled,
      refetchInterval: 4000,
    },
  });

  const poolState = data?.[0]?.result as
    | readonly [bigint, number, bigint]
    | undefined;
  const sqrtPriceX96 = poolState?.[0];
  const tick = poolState?.[1];
  const liquidity = poolState?.[2];
  const poolMochiReserve = data?.[1]?.result as bigint | undefined;

  // Spot price = (sqrtPriceX96 / 2^96)^2 — gives MOCHI per ETH for currency0=ETH.
  let mochiPerEth: number | undefined;
  if (sqrtPriceX96 && sqrtPriceX96 > 0n) {
    const sq = Number(sqrtPriceX96) / 2 ** 96;
    mochiPerEth = sq * sq;
  }

  // Estimate the pool's ETH reserves: pool MOCHI / current rate. Approximation that
  // assumes the entire pool MOCHI balance is in-range at current price.
  let poolEthReserve: bigint | undefined;
  if (mochiPerEth && mochiPerEth > 0 && poolMochiReserve !== undefined) {
    const mochiAsNumber = Number(poolMochiReserve) / 1e18;
    const ethAsNumber = mochiAsNumber / mochiPerEth;
    poolEthReserve = BigInt(Math.floor(ethAsNumber * 1e18));
  }

  return {
    isLoading,
    refetch,
    sqrtPriceX96,
    tick,
    liquidity,
    poolMochiReserve,
    poolEthReserve,
    mochiPerEth,
  };
}
