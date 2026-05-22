import { useReadContracts } from "wagmi";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";

export function useGardenCurve(previewEth?: bigint) {
  const { deployment } = useMochi();
  const enabled = !!deployment;

  const contracts: object[] = [];
  if (enabled) {
    contracts.push(
      {
        address: deployment!.hook,
        abi: MochiHookAbi as never,
        functionName: "currentMintPrice",
      },
      {
        address: deployment!.hook,
        abi: MochiHookAbi as never,
        functionName: "gardenInventoryRemaining",
      },
      {
        address: deployment!.hook,
        abi: MochiHookAbi as never,
        functionName: "gardenSupplyMinted",
      },
      {
        address: deployment!.hook,
        abi: MochiHookAbi as never,
        functionName: "GARDEN_INITIAL_INVENTORY",
      },
    );
    if (previewEth && previewEth > 0n) {
      contracts.push({
        address: deployment!.hook,
        abi: MochiHookAbi as never,
        functionName: "previewMint",
        args: [previewEth],
      });
    }
  }

  const { data, refetch, isLoading } = useReadContracts({
    contracts: contracts as never,
    query: { enabled, refetchInterval: 3000 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[] | undefined) ?? [];

  return {
    isLoading,
    refetch,
    currentPrice: rows[0]?.result as bigint | undefined,
    inventoryRemaining: rows[1]?.result as bigint | undefined,
    supplyMinted: rows[2]?.result as bigint | undefined,
    initialInventory: rows[3]?.result as bigint | undefined,
    preview: previewEth && previewEth > 0n
      ? (rows[4]?.result as [bigint, bigint] | undefined)
      : undefined,
  };
}
