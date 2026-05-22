import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, type Address } from "viem";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";

export function useUserGameState() {
  const { address } = useAccount();
  const { deployment } = useMochi();
  const enabled = !!deployment && !!address;

  const { data: ethBal } = useBalance({
    address: address as Address | undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  const { data, refetch, isLoading } = useReadContracts({
    contracts: enabled
      ? [
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "getMySeeds",
            args: [address!],
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "gardeners",
            args: [address!],
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "lastActionTime",
            args: [address!],
          },
          {
            address: deployment!.hook,
            abi: MochiHookAbi as never,
            functionName: "isActiveLP",
            args: [address!],
          },
          {
            address: deployment!.mochi,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address!],
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
    seeds: data?.[0]?.result as bigint | undefined,
    gardeners: data?.[1]?.result as bigint | undefined,
    lastActionTime: data?.[2]?.result as bigint | undefined,
    isActiveLP: data?.[3]?.result as boolean | undefined,
    mochiBalance: data?.[4]?.result as bigint | undefined,
    ethBalance: ethBal?.value,
  };
}
