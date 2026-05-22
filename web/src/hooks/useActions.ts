import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { type Hash, type Address, maxUint160, encodeAbiParameters } from "viem";
import MochiHookAbi from "../abi/MochiHook.json";
import PoolSwapTestAbi from "../abi/PoolSwapTest.json";
import { useMochi } from "./useMochi";

/// Encode the user's address into v4 hookData. The hook's `_resolveUser` reads this so
/// AA wallets / smart accounts get credited correctly for SEED drips and LP rebates.
export function encodeUserHookData(user: Address): `0x${string}` {
  return encodeAbiParameters([{ type: "address" }], [user]);
}

type ActionState = "idle" | "submitting" | "confirming" | "done" | "error";

export function useCast() {
  const { deployment } = useMochi();
  const { data: wallet } = useWalletClient();
  const pc = usePublicClient();
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  async function cast(referrer: Address) {
    if (!wallet || !deployment || !pc) return;
    setState("submitting");
    setError(null);
    try {
      const tx = await wallet.writeContract({
        address: deployment.hook,
        abi: MochiHookAbi as never,
        functionName: "cast",
        args: [referrer],
      });
      setHash(tx);
      setState("confirming");
      await pc.waitForTransactionReceipt({ hash: tx });
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return { cast, state, hash, error, reset: () => setState("idle") };
}

export function useSell() {
  const { deployment } = useMochi();
  const { data: wallet } = useWalletClient();
  const pc = usePublicClient();
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  async function sell() {
    if (!wallet || !deployment || !pc) return;
    setState("submitting");
    setError(null);
    try {
      const tx = await wallet.writeContract({
        address: deployment.hook,
        abi: MochiHookAbi as never,
        functionName: "sell",
        args: [],
      });
      setHash(tx);
      setState("confirming");
      await pc.waitForTransactionReceipt({ hash: tx });
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return { sell, state, hash, error, reset: () => setState("idle") };
}

/** Swap ETH -> MOCHI through the test PoolSwapTest router. v4-native. */
export function useSwap() {
  const { deployment } = useMochi();
  const { data: wallet } = useWalletClient();
  const { address } = useAccount();
  const pc = usePublicClient();
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  // sqrtPriceLimitX96 for zeroForOne swaps must be > MIN_SQRT_PRICE.
  // Constants from v4-core TickMath.
  const MIN_SQRT = 4295128739n;
  const MAX_SQRT = 1461446703485210103287273052203988822378723970342n;

  async function swap(direction: "ethToMochi" | "mochiToEth", amountIn: bigint) {
    if (!wallet || !deployment || !pc || !address) return;
    setState("submitting");
    setError(null);

    const zeroForOne = direction === "ethToMochi";
    const sqrtPriceLimit = zeroForOne ? MIN_SQRT + 1n : MAX_SQRT - 1n;

    try {
      // For MOCHI -> ETH we need to approve the swap router first.
      if (!zeroForOne) {
        const erc20Approve = await wallet.writeContract({
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
          args: [deployment.swapRouter, amountIn],
        });
        await pc.waitForTransactionReceipt({ hash: erc20Approve });
      }

      const key = {
        currency0: deployment.currency0,
        currency1: deployment.currency1,
        fee: deployment.fee,
        tickSpacing: deployment.tickSpacing,
        hooks: deployment.hook,
      };
      const params = {
        zeroForOne,
        amountSpecified: -amountIn, // negative = exact-input
        sqrtPriceLimitX96: sqrtPriceLimit,
      };
      const settings = { takeClaims: false, settleUsingBurn: false };

      const tx = await wallet.writeContract({
        address: deployment.swapRouter,
        abi: PoolSwapTestAbi as never,
        functionName: "swap",
        args: [key, params, settings, encodeUserHookData(address)],
        value: zeroForOne ? amountIn : 0n,
      });
      setHash(tx);
      setState("confirming");
      await pc.waitForTransactionReceipt({ hash: tx });
      setState("done");
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return { swap, state, hash, error, reset: () => setState("idle") };
}

/* unused but kept for future limit-order wiring */
export const _MAX_U160 = maxUint160;
