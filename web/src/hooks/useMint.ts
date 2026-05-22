import { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { type Hash } from "viem";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";

type ActionState = "idle" | "submitting" | "confirming" | "done" | "error";

export function useMint() {
  const { deployment } = useMochi();
  const { data: wallet } = useWalletClient();
  const { address } = useAccount();
  const pc = usePublicClient();

  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  async function mint(ethAmount: bigint) {
    if (!wallet || !deployment || !pc || !address) return;
    setState("submitting");
    setError(null);
    setHash(null);
    try {
      const tx = await wallet.writeContract({
        address: deployment.hook,
        abi: MochiHookAbi as never,
        functionName: "mintFromGarden",
        args: [],
        value: ethAmount,
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

  return { mint, state, error, hash, reset: () => setState("idle") };
}
