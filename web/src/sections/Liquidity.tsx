import { useState, useEffect } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import { Frame, InnerFrame, Sticker, Tape } from "../components/Primitives";
import { useAddLiquidity } from "../hooks/useAddLiquidity";
import { useRemoveLiquidity } from "../hooks/useRemoveLiquidity";
import { useUserGameState } from "../hooks/useUserGameState";
import { usePoolMetrics } from "../hooks/usePoolMetrics";
import { fmt } from "../lib/format";
import { TxLink } from "../components/TxLink";

/// Liquidity panel for the hook pool. Two inputs (ETH + MOCHI), auto-balanced at the
/// current pool spot price. On Anvil this goes through PoolModifyLiquidityTest; on real
/// chains we'll swap to PositionManager + Permit2.
export function Liquidity() {
  const { isConnected } = useAccount();
  const { ethBalance, mochiBalance, isActiveLP, refetch } = useUserGameState();
  const { mochiPerEth } = usePoolMetrics();
  const { addLiquidity, state, error, hash, reset } = useAddLiquidity();
  const {
    positions,
    remove,
    state: removeState,
    error: removeError,
    refresh: refreshPositions,
  } = useRemoveLiquidity();

  const [ethAmount, setEthAmount] = useState("0.01");
  const [mochiAmount, setMochiAmount] = useState("0.01");
  const [lastEdited, setLastEdited] = useState<"eth" | "mochi">("eth");

  // Auto-balance the un-edited side whenever the spot price changes or the user
  // edits one side. Uses the linear approximation around the symmetric range,
  // which is accurate when the position covers the current price.
  useEffect(() => {
    if (!mochiPerEth || !Number.isFinite(mochiPerEth) || mochiPerEth <= 0) return;
    if (lastEdited === "eth") {
      const e = parseFloat(ethAmount);
      if (Number.isFinite(e) && e > 0) {
        const target = e * mochiPerEth;
        // Round to a sensible precision based on magnitude — no fractional dust
        // for huge MOCHI counts; no scientific notation for tiny ones.
        const formatted =
          target >= 1e6
            ? target.toFixed(0)
            : target >= 1
            ? target.toFixed(2)
            : target.toFixed(6);
        setMochiAmount(formatted);
      } else {
        setMochiAmount("0");
      }
    } else {
      const m = parseFloat(mochiAmount);
      if (Number.isFinite(m) && m > 0) {
        const target = m / mochiPerEth;
        const formatted =
          target >= 0.01
            ? target.toFixed(6)
            : target.toFixed(10);
        setEthAmount(formatted);
      } else {
        setEthAmount("0");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethAmount, mochiAmount, mochiPerEth, lastEdited]);

  const busy =
    state === "approving" || state === "submitting" || state === "confirming";

  async function onAdd() {
    try {
      const eth = parseEther(ethAmount);
      const mochi = parseEther(mochiAmount);
      // Send slight ETH buffer for rounding inside modifyLiquidity.
      const ethToSend = (eth * 105n) / 100n;
      // useAddLiquidity computes the correct liquidityDelta from these amounts.
      await addLiquidity(ethToSend, mochi);
      await refetch();
      refreshPositions();
    } catch {
      // surfaced via state/error
    }
  }

  const canSubmit = isConnected && !busy && parseFloat(ethAmount || "0") > 0;

  const ethEnough =
    !ethBalance || parseFloat(ethAmount) <= parseFloat(formatEther(ethBalance));
  const mochiEnough =
    !mochiBalance ||
    parseFloat(mochiAmount) <= parseFloat(formatEther(mochiBalance));

  return (
    <Frame className="relative">
      <span className="absolute -top-3 left-8">
        <Tape rotate={-7}>be the pool ✿ earn fees</Tape>
      </span>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">add liquidity ♡</h2>
        {isActiveLP ? (
          <Sticker tone="mint" rotate={3}>
            active LP — 50% off swap fees ✨
          </Sticker>
        ) : (
          <Sticker tone="butter" rotate={-3}>
            not yet an LP
          </Sticker>
        )}
      </div>

      <InnerFrame>
        <p className="mb-3 font-body text-sm text-ink/80">
          deposit ETH <em>and</em> MOCHI together to back the pool. earn 0.5–1%
          of every swap + half off your own swaps while u&apos;re an LP ~
        </p>

        <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink/55">
          ETH side
        </label>
        <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-ink/40 bg-cream-50 p-2">
          <input
            type="number"
            inputMode="decimal"
            value={ethAmount}
            onChange={(e) => {
              setEthAmount(e.target.value);
              setLastEdited("eth");
            }}
            className="w-full bg-transparent font-display text-2xl text-ink outline-none"
            placeholder="0.0"
            step="0.05"
            min="0"
          />
          <Sticker tone="cream" rotate={3}>
            ETH
          </Sticker>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink/55">
          <span>balance: {fmt(ethBalance)} ETH</span>
          {!ethEnough ? (
            <span className="text-pink-500">not enough eth in wallet</span>
          ) : null}
        </div>

        <div className="my-2 text-center font-pixel text-xs text-ink/60">+</div>

        <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink/55">
          MOCHI side
        </label>
        <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-ink/40 bg-cream-50 p-2">
          <input
            type="number"
            inputMode="decimal"
            value={mochiAmount}
            onChange={(e) => {
              setMochiAmount(e.target.value);
              setLastEdited("mochi");
            }}
            className="w-full bg-transparent font-display text-2xl text-ink outline-none"
            placeholder="0.0"
            step="0.05"
            min="0"
          />
          <Sticker tone="cream" rotate={-3}>
            MOCHI
          </Sticker>
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink/55">
          <span>balance: {fmt(mochiBalance)} MOCHI</span>
          {!mochiEnough ? (
            <span className="text-pink-500">not enough mochi in wallet</span>
          ) : null}
        </div>


        <button
          className="kc-btn kc-btn-mint w-full"
          disabled={!canSubmit || !ethEnough || !mochiEnough}
          onClick={onAdd}
        >
          {state === "approving"
            ? "approving mochi …"
            : state === "submitting"
            ? "adding in your wallet …"
            : state === "confirming"
            ? "confirming …"
            : state === "done"
            ? "done ♡ add more?"
            : "add liquidity ✦"}
        </button>

        {state === "error" && error ? (
          <div className="mt-2 rounded border border-dashed border-pink-500 bg-pink-50 p-2 text-xs text-pink-500">
            oops {">_<"} — {error.slice(0, 240)}
          </div>
        ) : null}
        {hash ? (
          <div className="mt-2 text-[10px] text-ink/55">
            tx: <TxLink hash={hash} />
            <button className="ml-2 underline" onClick={reset}>
              clear
            </button>
          </div>
        ) : null}

        <p className="mt-3 font-body text-[11px] text-ink/55">
          impermanent loss is real ~ if mochi flies up or down vs eth your LP
          value may underperform just-holding-both. fees compensate, ymmv (◕‿◕✿)
        </p>
      </InnerFrame>

      {positions.length > 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-ink/30 bg-cream-50/70 p-2">
          <div className="mb-1 font-pixel text-[10px] uppercase tracking-wider text-ink/55">
            your positions
          </div>
          {positions.map((pos, i) => (
            <div
              key={`${pos.tickLower}-${pos.tickUpper}-${pos.addedAt}`}
              className="flex items-center justify-between gap-2 border-t border-dotted border-ink/20 py-1 text-[11px] text-ink/75 first:border-t-0"
            >
              <div>
                <div>
                  ticks <span className="font-pixel">[{pos.tickLower} .. {pos.tickUpper}]</span>
                </div>
                <div className="text-[10px] text-ink/50">
                  L: {pos.liquidity.slice(0, 8)}… · added {new Date(pos.addedAt * 1000).toLocaleDateString()}
                </div>
              </div>
              <button
                className="rounded border border-ink/40 bg-pink-100 px-2 py-[2px] text-[10px] text-ink hover:bg-pink-200 disabled:opacity-50"
                disabled={
                  removeState === "submitting" || removeState === "confirming"
                }
                onClick={() => remove(i)}
              >
                {removeState === "submitting" || removeState === "confirming"
                  ? "removing …"
                  : "remove"}
              </button>
            </div>
          ))}
          {removeError ? (
            <div className="mt-2 rounded border border-dashed border-pink-500 bg-pink-50 p-2 text-[10px] text-pink-500">
              {removeError.slice(0, 200)}
            </div>
          ) : null}
        </div>
      ) : null}
    </Frame>
  );
}
