import { useState, useMemo } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { Frame, InnerFrame, Sticker, Tape } from "../components/Primitives";
import { useUserGameState } from "../hooks/useUserGameState";
import { usePoolStats } from "../hooks/usePoolStats";
import { usePoolMetrics } from "../hooks/usePoolMetrics";
import { useSwap } from "../hooks/useActions";
import { fmt, fmtFee } from "../lib/format";
import { TxLink } from "../components/TxLink";
import {
  estimateAmountOut0For1,
  estimateAmountOut1For0,
  applyFee,
} from "../lib/swapMath";

export function Pool() {
  const { isConnected } = useAccount();
  const { ethBalance, mochiBalance } = useUserGameState();
  const { dynamicFee } = usePoolStats();
  const { sqrtPriceX96, liquidity } = usePoolMetrics();
  const { swap, state, error, hash } = useSwap();

  const [side, setSide] = useState<"ethToMochi" | "mochiToEth">("ethToMochi");
  const [amount, setAmount] = useState<string>("0.1");

  const previewOut = useMemo(() => {
    try {
      const amt = parseEther(amount);
      if (amt === 0n || !sqrtPriceX96 || !liquidity) return undefined;
      const raw =
        side === "ethToMochi"
          ? estimateAmountOut0For1(amt, sqrtPriceX96, liquidity)
          : estimateAmountOut1For0(amt, sqrtPriceX96, liquidity);
      return applyFee(raw, dynamicFee);
    } catch {
      return undefined;
    }
  }, [amount, side, sqrtPriceX96, liquidity, dynamicFee]);

  const busy = state === "submitting" || state === "confirming";
  const balance = side === "ethToMochi" ? ethBalance : mochiBalance;
  const symbol = side === "ethToMochi" ? "ETH" : "MOCHI";
  const otherSymbol = side === "ethToMochi" ? "MOCHI" : "ETH";

  const canSubmit = isConnected && !busy && parseFloat(amount || "0") > 0;

  async function onSwap() {
    try {
      const amt = parseEther(amount);
      await swap(side, amt);
    } catch {
      // swallow; state has error
    }
  }

  return (
    <Frame className="relative flex h-full flex-col">
      <span className="absolute -top-3 left-6">
        <Tape rotate={-7}>pool ✿ ETH ⇄ MOCHI</Tape>
      </span>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">the pool ♡</h2>
        <Sticker tone="sky" rotate={3}>fee ~ {fmtFee(dynamicFee)}</Sticker>
      </div>

      <InnerFrame className="flex-1">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            className={`kc-btn text-sm ${side === "ethToMochi" ? "kc-btn-mint" : "bg-cream-100"}`}
            onClick={() => setSide("ethToMochi")}
          >
            buy mochi
          </button>
          <button
            className={`kc-btn text-sm ${side === "mochiToEth" ? "kc-btn-pink" : "bg-cream-100"}`}
            onClick={() => setSide("mochiToEth")}
          >
            sell mochi
          </button>
        </div>

        <label className="mb-2 block text-xs uppercase tracking-wider text-ink/55">
          you pay
        </label>
        <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-ink/40 bg-cream-50 p-2">
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent font-display text-2xl text-ink outline-none"
            placeholder="0.0"
            step="0.01"
            min="0"
          />
          <Sticker tone="cream" rotate={3}>{symbol}</Sticker>
        </div>
        <div className="mt-1 text-[11px] text-ink/55">
          balance: {fmt(balance)} {symbol}
        </div>

        <div className="my-3 text-center font-pixel text-xs text-ink/60">↓ ↓ ↓</div>

        <div className="rounded-md border-2 border-dotted border-ink/30 bg-cream-50 p-2 text-sm text-ink/70">
          receive:{" "}
          <span className="font-display text-lg text-ink">
            {previewOut !== undefined ? fmt(previewOut) : "—"}
          </span>{" "}
          {otherSymbol}
          {side === "ethToMochi" ? (
            <div className="mt-1 text-[11px] text-pink-500">+ SEED drip ✿</div>
          ) : null}
          <div className="mt-1 text-[10px] text-ink/55">
            estimated — slippage rises sharply on thin liquidity
          </div>
        </div>

        <button
          className="kc-btn kc-btn-mint mt-4 w-full"
          disabled={!canSubmit}
          onClick={onSwap}
        >
          {state === "submitting"
            ? "asking your wallet …"
            : state === "confirming"
            ? "confirming on-chain …"
            : state === "done"
            ? "done ♡ swap again?"
            : side === "ethToMochi"
            ? "swap! (get mochi + seeds)"
            : "swap! (get eth)"}
        </button>

        {state === "error" && error ? (
          <div className="mt-2 rounded border border-dashed border-pink-500 bg-pink-50 p-2 text-xs text-pink-500">
            oops {">_<"} — {error.slice(0, 220)}
          </div>
        ) : null}
        {hash ? (
          <div className="mt-2 text-[10px] text-ink/55">tx: <TxLink hash={hash} /></div>
        ) : null}
      </InnerFrame>
    </Frame>
  );
}
