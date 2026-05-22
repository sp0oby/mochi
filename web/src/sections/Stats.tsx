import { Frame, Stat, Sticker, Tape } from "../components/Primitives";
import { usePoolStats } from "../hooks/usePoolStats";
import { usePoolMetrics } from "../hooks/usePoolMetrics";
import { useGardenCurve } from "../hooks/useGardenCurve";
import { fmt, fmtCompact, fmtFee, fmtSeeds } from "../lib/format";

export function Stats() {
  const {
    marketSeeds,
    mochiTreasury,
    totalGardeners,
    dynamicFee,
    mochiTotalSupply,
    lpReserve,
    cumulativeMintInflow,
    lastAutoDeepenAt,
  } = usePoolStats();

  const { poolEthReserve, poolMochiReserve, tick, liquidity } = usePoolMetrics();
  const { inventoryRemaining: gardenInventoryRemaining } = useGardenCurve();
  const poolHasLiquidity = (liquidity ?? 0n) > 0n;

  // Auto-deepen progress toward the next trigger. Mirrors the contract constant —
  // testnet build = 0.05 ETH. Mainnet build = 5 ETH. Bump this together with the
  // contract on any redeploy.
  const AUTO_DEEPEN_TRIGGER_WEI = 50_000_000_000_000_000n; // 0.05 ETH (testnet)
  const triggerEth = Number(AUTO_DEEPEN_TRIGGER_WEI) / 1e18;
  const progressWei =
    cumulativeMintInflow !== undefined && lastAutoDeepenAt !== undefined
      ? cumulativeMintInflow - lastAutoDeepenAt
      : undefined;
  const progressEth =
    progressWei !== undefined ? Number(progressWei) / 1e18 : undefined;
  const progressPct =
    progressWei !== undefined
      ? Math.min(100, Number((progressWei * 10_000n) / AUTO_DEEPEN_TRIGGER_WEI) / 100)
      : undefined;

  // Treasury runway: 200M MOCHI was the initial allocation. Drops as players harvest;
  // can grow above 100% if refillTreasury runs faster than harvests.
  const treasuryRunwayPct = (() => {
    if (mochiTreasury === undefined) return undefined;
    const original = 200_000_000n * 10n ** 18n;
    return Number((mochiTreasury * 10_000n) / original) / 100;
  })();

  // Circulating supply = totalSupply - treasury - gardenInventory - lpReserve - poolReserve.
  // What's left is MOCHI actually held in user wallets (not earmarked by the protocol).
  const circulatingSupply = (() => {
    if (
      mochiTotalSupply === undefined ||
      mochiTreasury === undefined ||
      gardenInventoryRemaining === undefined ||
      poolMochiReserve === undefined ||
      lpReserve === undefined
    )
      return undefined;
    const protocolHeld = mochiTreasury + gardenInventoryRemaining + lpReserve;
    if (mochiTotalSupply < protocolHeld + poolMochiReserve) return 0n;
    return mochiTotalSupply - protocolHeld - poolMochiReserve;
  })();

  return (
    <Frame className="relative">
      <span className="absolute -top-3 left-8">
        <Tape rotate={-7}>garden vibes</Tape>
      </span>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">garden stats ✿</h2>
        <Sticker tone="butter">live ♡ updating</Sticker>
      </div>

      <div className="mb-2 text-[10px] uppercase tracking-widest text-ink/55">
        ◆ pool ◆
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="pool ETH"
          value={poolEthReserve !== undefined && poolHasLiquidity ? fmt(poolEthReserve) : "—"}
          sub={poolHasLiquidity ? "in the pool" : "no liquidity yet"}
        />
        <Stat
          label="pool MOCHI"
          value={poolHasLiquidity ? fmtCompact(poolMochiReserve) : "—"}
          sub={poolHasLiquidity ? "in the pool" : "waiting for LP"}
        />
        <Stat
          label="auto-deepen"
          value={
            progressEth !== undefined
              ? `${progressEth.toFixed(4)} / ${triggerEth} ETH`
              : "—"
          }
          sub={
            progressPct !== undefined
              ? `${progressPct.toFixed(1)}% to next LP add`
              : "tracks mint inflow"
          }
        />
        <Stat
          label="dyn fee"
          value={fmtFee(dynamicFee)}
          sub={`tick ${tick ?? "—"}`}
        />
      </div>

      <div className="mb-2 text-[10px] uppercase tracking-widest text-ink/55">
        ◆ game ◆
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="treasury"
          value={fmtCompact(mochiTreasury)}
          sub={treasuryRunwayPct !== undefined ? `${treasuryRunwayPct.toFixed(1)}% left` : "MOCHI"}
        />
        <Stat
          label="lp reserve"
          value={fmtCompact(lpReserve)}
          sub="auto-deepen fuel"
        />
        <Stat label="market seeds" value={fmtSeeds(marketSeeds)} sub="bonding curve" />
        <Stat label="gardeners" value={fmtSeeds(totalGardeners)} sub="all players" />
        <Stat
          label="total $MOCHI"
          value={fmtCompact(mochiTotalSupply)}
          sub="1B fixed supply"
        />
        <Stat
          label="circulating"
          value={fmtCompact(circulatingSupply)}
          sub="in user wallets"
        />
      </div>

      <p className="mt-3 font-body text-xs text-ink/55">
        treasury is capped at 0.1% per harvest so it lasts years. every 5 ETH of
        mints, the hook auto-LPs a slice into the pool from the lp reserve ~
        early players still get the cheapest curve (◕‿◕✿)
      </p>
    </Frame>
  );
}
