import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { type Hash } from "viem";
import PoolModifyLiquidityTestAbi from "../abi/PoolModifyLiquidityTest.json";
import { useMochi } from "./useMochi";
import { encodeUserHookData } from "./useActions";
import { getPositions, removePosition, type Position } from "../lib/positions";

type ActionState = "idle" | "submitting" | "confirming" | "done" | "error";

export function useRemoveLiquidity() {
  const { deployment } = useMochi();
  const { data: wallet } = useWalletClient();
  const { address } = useAccount();
  const pc = usePublicClient();

  const [positions, setPositions] = useState<Position[]>([]);
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  const refreshPositions = useCallback(() => {
    if (!deployment || !address) {
      setPositions([]);
      return;
    }
    setPositions(getPositions(deployment.chainId, address));
  }, [deployment, address]);

  useEffect(() => {
    refreshPositions();
  }, [refreshPositions]);

  async function remove(idx: number) {
    if (!wallet || !deployment || !pc || !address) return;
    const pos = positions[idx];
    if (!pos) return;

    setState("submitting");
    setError(null);
    setHash(null);

    try {
      const key = {
        currency0: deployment.currency0,
        currency1: deployment.currency1,
        fee: deployment.fee,
        tickSpacing: deployment.tickSpacing,
        hooks: deployment.hook,
      };
      const params = {
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        liquidityDelta: -BigInt(pos.liquidity), // negative = remove
        salt: pos.salt,
      };

      const tx = await wallet.writeContract({
        address: deployment.liquidityRouter,
        abi: PoolModifyLiquidityTestAbi as never,
        functionName: "modifyLiquidity",
        args: [key, params, encodeUserHookData(address)],
      });
      setHash(tx);
      setState("confirming");
      await pc.waitForTransactionReceipt({ hash: tx });

      removePosition(deployment.chainId, address, idx);
      refreshPositions();
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return {
    positions,
    remove,
    state,
    error,
    hash,
    refresh: refreshPositions,
    reset: () => setState("idle"),
  };
}
