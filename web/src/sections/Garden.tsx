import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Frame, InnerFrame, Stat, Sticker, Tape } from "../components/Primitives";
import { useUserGameState } from "../hooks/useUserGameState";
import { useCast, useSell } from "../hooks/useActions";
import { useReferral } from "../hooks/useReferral";
import { fmtSeeds, fmt, truncAddr } from "../lib/format";

const SEEDS_PER_GARDENER = 86_400n;

export function Garden() {
  const { address, isConnected } = useAccount();
  const { seeds, gardeners, mochiBalance, refetch } = useUserGameState();
  const { cast, state: castState, error: castError } = useCast();
  const { sell, state: sellState, error: sellError } = useSell();
  const { referrer, lockedOnChain, isLocked, pendingLocal, isSelfReferral, shareLink } =
    useReferral();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (castState === "done" || sellState === "done") refetch();
  }, [castState, sellState, refetch]);

  const castBusy = castState === "submitting" || castState === "confirming";
  const sellBusy = sellState === "submitting" || sellState === "confirming";

  const seedsBig = (seeds ?? 0n) > 0n;
  const hasGardeners = (gardeners ?? 0n) > 0n;

  // Live ticker so the "X SEEDs/sec" feels alive even without on-chain refetch.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const productionPerSec = gardeners ?? 0n;
  const seedsToNextGardener =
    seedsBig && seeds! < SEEDS_PER_GARDENER
      ? SEEDS_PER_GARDENER - (seeds ?? 0n)
      : 0n;
  const secsToNextGardener =
    productionPerSec > 0n && seedsToNextGardener > 0n
      ? seedsToNextGardener / productionPerSec
      : 0n;

  return (
    <Frame className="relative flex h-full flex-col">
      <span className="absolute -top-3 left-8">
        <Tape rotate={-7}>your garden 🌱</Tape>
      </span>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">my garden ♡</h2>
        <Sticker tone="mint" rotate={-3}>
          {address ? `me ${address.slice(0, 6)}…${address.slice(-4)}` : "not connected"}
        </Sticker>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="🌱 seeds" value={fmtSeeds(seeds)} sub="ready to cast" />
        <Stat label="👩‍🌾 gardeners" value={fmtSeeds(gardeners)} sub="seeds/sec" />
        <Stat label="🍡 mochi" value={fmt(mochiBalance)} sub="in wallet" />
      </div>

      <InnerFrame>
        <p className="mb-2 font-body text-sm text-ink/80">
          cast all your seeds → grow new gardeners (compound)
        </p>
        <button
          className="kc-btn kc-btn-mint w-full"
          disabled={!isConnected || castBusy || !seedsBig}
          onClick={() => cast(referrer)}
        >
          {castState === "submitting"
            ? "casting in your wallet …"
            : castState === "confirming"
            ? "confirming …"
            : castState === "done"
            ? "cast! ♡ again?"
            : !seedsBig
            ? "no seeds yet — go buy mochi 🌱"
            : "cast seeds ✦"}
        </button>
        {castError ? (
          <div className="mt-2 rounded border border-dashed border-pink-500 bg-pink-50 p-2 text-xs text-pink-500">
            {castError.slice(0, 180)}
          </div>
        ) : null}
      </InnerFrame>

      {/* Live production line — single thin row that flexes to absorb any leftover
          vertical space between cast and sell so we match the other card's height. */}
      <div className="my-3 flex flex-1 items-center justify-center rounded-md border border-dashed border-ink/30 bg-cream-50/40 px-3 py-2 text-center font-pixel text-[11px] text-ink/60">
        {hasGardeners ? (
          <span>
            {productionPerSec.toString()} SEED/sec ·{" "}
            {seedsToNextGardener === 0n
              ? "ready to cast ✿"
              : `${secsToNextGardener.toString()}s til next gardener`}
          </span>
        ) : (
          <span>mochi-chan is bored ~ buy mochi to start growing 🌱</span>
        )}
      </div>

      <InnerFrame>
        <p className="mb-2 font-body text-sm text-ink/80">
          sell seed yield → harvest MOCHI from the treasury (1% protocol fee)
        </p>
        <button
          className="kc-btn kc-btn-butter w-full"
          disabled={!isConnected || sellBusy || !seedsBig}
          onClick={() => sell()}
        >
          {sellState === "submitting"
            ? "selling in your wallet …"
            : sellState === "confirming"
            ? "confirming …"
            : sellState === "done"
            ? "harvest! ♡ again?"
            : hasGardeners
            ? "harvest yield ✿"
            : "no yield yet — cast seeds first"}
        </button>
        {sellError ? (
          <div className="mt-2 rounded border border-dashed border-pink-500 bg-pink-50 p-2 text-xs text-pink-500">
            {sellError.slice(0, 180)}
          </div>
        ) : null}
      </InnerFrame>

      {/* Referral footer — shows current state + share link */}
      <div className="mt-3 rounded-md border border-dashed border-ink/30 bg-cream-50/70 p-2 text-[11px] text-ink/65">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-pixel uppercase tracking-wider text-ink/55">
            referrals ✿ 12% kickback
          </span>
          {isLocked ? (
            <Sticker tone="mint" rotate={3}>
              locked ♡
            </Sticker>
          ) : pendingLocal && !isSelfReferral ? (
            <Sticker tone="butter" rotate={-3}>
              pending lock
            </Sticker>
          ) : (
            <Sticker tone="cream" rotate={3}>
              no referrer
            </Sticker>
          )}
        </div>
        {isLocked ? (
          <div>
            your referrer:{" "}
            <span className="font-pixel">{truncAddr(lockedOnChain)}</span> · earns 12% of
            every cast you do ♡ (locked on-chain, can&apos;t change)
          </div>
        ) : pendingLocal && !isSelfReferral ? (
          <div>
            will lock to{" "}
            <span className="font-pixel">{truncAddr(pendingLocal)}</span> on your first
            cast (they need ≥1 gardener to be eligible, anti-sybil rule)
          </div>
        ) : isSelfReferral ? (
          <div className="text-pink-500">
            you set yourself as referrer — that doesn&apos;t count ~ try a friend&apos;s
            link instead
          </div>
        ) : (
          <div>
            no referrer set. share your own link below so friends&apos; casts kick back to
            you ✿
          </div>
        )}
        {shareLink ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={shareLink}
              className="w-full rounded border border-ink/30 bg-cream-100 px-1 py-[2px] text-[10px] text-ink/70"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              className="rounded border border-ink/40 bg-pink-100 px-2 py-[2px] text-[10px] text-ink hover:bg-pink-200"
              onClick={() => {
                navigator.clipboard.writeText(shareLink).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "copied ♡" : "copy"}
            </button>
          </div>
        ) : (
          <div className="mt-2 rounded border border-dotted border-ink/30 bg-cream-100 px-2 py-1 text-[10px] text-ink/55">
            connect your wallet ♡ then your personal share link will appear here
          </div>
        )}
      </div>
    </Frame>
  );
}
