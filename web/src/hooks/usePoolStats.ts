import { useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";

export function usePoolStats() {
  const { deployment } = useMochi();
  const enabled = !!deployment;

  const { data, refetch, isLoading } = useReadContracts({
    contracts: enabled
      ? [
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "marketSeeds",
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "mochiTreasury",
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "totalGardeners",
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "currentDynamicFee",
          },
          {
            address: deployment!.mochi,
            abi: erc20Abi,
            functionName: "totalSupply",
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "lpReserve",
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "cumulativeMintInflow",
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "lastAutoDeepenAt",
          },
        ]
      : [],
    query: {
      enabled,
      refetchInterval: 3000,
    },
  });

  return {
    isLoading,
    refetch,
    marketSeeds: data?.[0]?.result as bigint | undefined,
    mochiTreasury: data?.[1]?.result as bigint | undefined,
    totalGardeners: data?.[2]?.result as bigint | undefined,
    dynamicFee: data?.[3]?.result as number | undefined,
    mochiTotalSupply: data?.[4]?.result as bigint | undefined,
    lpReserve: data?.[5]?.result as bigint | undefined,
    cumulativeMintInflow: data?.[6]?.result as bigint | undefined,
    lastAutoDeepenAt: data?.[7]?.result as bigint | undefined,
  };
}
