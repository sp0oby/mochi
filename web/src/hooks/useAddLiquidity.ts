import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { type Hash } from "viem";
import PoolModifyLiquidityTestAbi from "../abi/PoolModifyLiquidityTest.json";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";
import { encodeUserHookData } from "./useActions";
import { addPosition } from "../lib/positions";
import { getLiquidityForAmounts, sqrtRatioAtTick } from "../lib/liquidityMath";

type ActionState = "idle" | "approving" | "submitting" | "confirming" | "done" | "error";

/// LP range half-width in ticks. ±600 ≈ ±6% price band around current tick.
const TICK_HALF_WIDTH = 600;
const TICK_SPACING = 60;

export function useAddLiquidity() {
  const { deployment } = useMochi();
  const { data: wallet } = useWalletClient();
  const { address } = useAccount();
  const pc = usePublicClient();

  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  async function addLiquidity(ethAmount: bigint, mochiAmount: bigint) {
    if (!wallet || !deployment || !pc || !address) return;
    setState("approving");
    setError(null);
    setHash(null);

    try {
      // Approve MOCHI to the liquidity router (max so subsequent adds don't need re-approval).
      const erc20MaxApprove = await wallet.writeContract({
        address: deployment.mochi,
        abi: [
          {
            type: "function",
            name: "approve",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ] as const,
        functionName: "approve",
        args: [
          deployment.liquidityRouter,
          BigInt(2) ** BigInt(256) - BigInt(1),
        ],
      });
      await pc.waitForTransactionReceipt({ hash: erc20MaxApprove });

      setState("submitting");

      // Read the pool's current state to compute the correct liquidityDelta from
      // the user's actual (ETH, MOCHI) inputs. Without this we'd just submit a
      // random L and pull whatever amounts that L happens to need.
      const poolState = (await pc.readContract({
        address: deployment.hook,
        abi: MochiHookAbi as never,
        functionName: "poolState",
      })) as readonly [bigint, number, bigint];
      const sqrtPriceX96 = poolState[0];
      const currentTick = poolState[1];

      const aligned = Math.floor(currentTick / TICK_SPACING) * TICK_SPACING;
      const tickLower = aligned - TICK_HALF_WIDTH;
      const tickUpper = aligned + TICK_HALF_WIDTH;

      const sqrtA = sqrtRatioAtTick(tickLower);
      const sqrtB = sqrtRatioAtTick(tickUpper);

      const liquidityDelta = getLiquidityForAmounts(
        sqrtPriceX96,
        sqrtA,
        sqrtB,
        ethAmount,
        mochiAmount,
      );
      if (liquidityDelta === 0n) {
        throw new Error("computed liquidity is zero — increase amounts");
      }

      const key = {
        currency0: deployment.currency0,
        currency1: deployment.currency1,
        fee: deployment.fee,
        tickSpacing: deployment.tickSpacing,
        hooks: deployment.hook,
      };
      const params = {
        tickLower,
        tickUpper,
        liquidityDelta,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      };

      const tx = await wallet.writeContract({
        address: deployment.liquidityRouter,
        abi: PoolModifyLiquidityTestAbi as never,
        functionName: "modifyLiquidity",
        args: [key, params, encodeUserHookData(address)],
        value: ethAmount,
      });
      setHash(tx);
      setState("confirming");
      await pc.waitForTransactionReceipt({ hash: tx });
      setState("done");

      // Persist the position so the user can remove it later via the UI.
      addPosition(deployment.chainId, address, {
        tickLower,
        tickUpper,
        liquidity: liquidityDelta.toString(),
        salt: params.salt,
        addedAt: Math.floor(Date.now() / 1000),
      });
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return {
    addLiquidity,
    state,
    error,
    hash,
    reset: () => setState("idle"),
  };
}
