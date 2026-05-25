import { useState, useMemo } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import { Frame, InnerFrame, Sticker, Tape } from "../components/Primitives";
import { useMint } from "../hooks/useMint";
import { useGardenCurve } from "../hooks/useGardenCurve";
import { useUserGameState } from "../hooks/useUserGameState";
import { fmt, fmtCompact } from "../lib/format";
import { TxLink } from "../components/TxLink";

/// Garden mint panel — rising-price bonding curve.
/// Pay ETH, get MOCHI at the current curve price. Each mint raises the next mint's price.
/// 1% of ETH goes to dev wallet; 99% stays in the hook for deepenPool / refillTreasury.
/// Also drips SEEDs to the buyer (same rate as pool buys).
export function Mint() {
  const { isConnected } = useAccount();
  const { refetch } = useUserGameState();

  const [ethAmount, setEthAmount] = useState("0.1");

  const previewEth = useMemo(() => {
    try {
      const v = parseEther(ethAmount);
      return v > 0n ? v : undefined;
    } catch {
      return undefined;
    }
  }, [ethAmount]);

  const {
    currentPrice,
    inventoryRemaining,
    supplyMinted,
    initialInventory,
    preview,
    refetch: refetchCurve,
  } = useGardenCurve(previewEth);

  const { mint, state, error, hash, reset } = useMint();

  const busy = state === "submitting" || state === "confirming";

  // Format curve % consumed
  const pctConsumed =
    initialInventory && supplyMinted !== undefined && initialInventory > 0n
      ? Number((supplyMinted * 10_000n) / initialInventory) / 100
      : 0;

  // Graduation: the contract will revert with GardenInventoryEmpty() once drained.
  // Gate the button so users don't waste gas on a guaranteed-failed tx.
  // `undefined` (still loading) does NOT count as graduated — only an explicit 0.
  const isGraduated = inventoryRemaining !== undefined && inventoryRemaining === 0n;
  // Last-mile: ≥99% consumed but not yet graduated. Contract caps + refunds the
  // overspend, but a heads-up keeps users from being surprised.
  const isLastMile = !isGraduated && pctConsumed >= 99;

  const canSubmit = isConnected && !busy && previewEth !== undefined && !isGraduated;

  void currentPrice; // used implicitly through previewMint output; reserved for future spot display

  const previewMochi = preview?.[0];
  const previewMochiPerEth =
    previewMochi && previewEth && previewEth > 0n
      ? Number(previewMochi) / Number(previewEth)
      : undefined;

  async function onMint() {
    if (!previewEth) return;
    try {
      await mint(previewEth);
      await refetch();
      await refetchCurve();
    } catch {
      // surfaced via state/error
    }
  }

  return (
    <Frame className="relative">
      <span className="absolute -top-3 left-8">
        <Tape rotate={-7}>garden mint ✿ rising curve</Tape>
      </span>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">mint from the garden ♡</h2>
        {isGraduated ? (
          <Sticker tone="pink" rotate={3}>✿ GRADUATED ✿</Sticker>
        ) : (
          <Sticker tone="mint" rotate={3}>
            🌱 {pctConsumed < 1 ? "early bird" : pctConsumed < 25 ? "growing" : pctConsumed < 75 ? "mid-curve" : pctConsumed < 99 ? "almost minted out" : "last-mile"}
          </Sticker>
        )}
      </div>

      <InnerFrame>
        {isGraduated ? (
          <div className="mb-3 rounded-md border-2 border-dashed border-pink-500 bg-pink-50/80 p-3 text-center">
            <div className="font-display text-lg text-ink">
              the garden minted out ♡
            </div>
            <p className="mt-1 font-body text-[13px] text-ink/80">
              every MOCHI on the curve has been sprouted. swap on the pool to get more
              ✿ (◕‿◕✿)
            </p>
          </div>
        ) : (
          <p className="mb-3 font-body text-sm text-ink/80">
            pay ETH, get fresh MOCHI. <span className="text-pink-500">the curve scales
            with demand</span> — price moves up gradually as more mochi sprouts ✿ also
            drips SEEDs into your wallet ~
          </p>
        )}

        {isLastMile ? (
          <div className="mb-3 rounded-md border border-dashed border-butter-300 bg-butter-100/60 p-2 text-[12px] text-ink/80">
            ⚠ last-mile: less than 1% of the curve left. the contract caps your mint to
            whatever inventory remains and refunds the unused ETH, so don&apos;t panic
            if you get less MOCHI than the preview ♡
          </div>
        ) : null}

        <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink/55">
          ETH to spend
        </label>
        <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-ink/40 bg-cream-50 p-2">
          <input
            type="number"
            inputMode="decimal"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            className="w-full bg-transparent font-display text-2xl text-ink outline-none"
            placeholder="0.0"
            step="0.05"
            min="0"
          />
          <Sticker tone="cream" rotate={3}>
            ETH
          </Sticker>
        </div>

        <div className="my-2 text-center font-pixel text-xs text-ink/60">↓</div>

        <div className="rounded-md border-2 border-dotted border-ink/30 bg-cream-50 p-2 text-sm">
          you receive:{" "}
          <span className="font-display text-lg text-ink">
            {previewMochi !== undefined ? fmt(previewMochi) : "—"} MOCHI
          </span>
          {previewMochiPerEth !== undefined && previewEth ? (
            <span className="ml-2 text-[11px] text-ink/55">
              (effective: ~{fmtCompact(BigInt(Math.floor(previewMochiPerEth)))} MOCHI/ETH for this size)
            </span>
          ) : null}
          <div className="mt-1 text-[11px] text-pink-500">
            + SEED drip ✿ ({previewMochi ? fmtCompact(previewMochi) : "—"} SEEDs)
          </div>
        </div>

        <button
          className="kc-btn kc-btn-mint mt-3 w-full"
          disabled={!canSubmit}
          onClick={onMint}
        >
          {isGraduated
            ? "minted out ♡ swap on the pool instead"
            : state === "submitting"
            ? "minting in your wallet …"
            : state === "confirming"
            ? "confirming …"
            : state === "done"
            ? "minted ♡ again?"
            : "mint mochi ✦"}
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

        <div className="mt-3 rounded bg-cream-50/70 p-2 text-[11px] text-ink/65">
          <div className="mb-1 flex justify-between">
            <span>curve inventory consumed</span>
            <span className="font-pixel">{pctConsumed.toFixed(2)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-ink/30 bg-cream-100">
            <div
              className="h-full bg-mint-300"
              style={{ width: `${Math.min(100, pctConsumed)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink/50">
            <span>{inventoryRemaining ? fmtCompact(inventoryRemaining) : "—"} MOCHI left</span>
            <span>700M total</span>
          </div>
        </div>
      </InnerFrame>
    </Frame>
  );
}

// silence unused import warning when the build is super strict
void formatEther;
