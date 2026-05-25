import type { ReactNode } from "react";
import { Frame, InnerFrame, Sticker, Tape } from "../components/Primitives";

/** Decora-leaning section heading: a HI-sticker, a title, a flanking sparkle row. */
function SectionHead({
  hi,
  title,
  tone = "pink",
}: {
  hi: string;
  title: string;
  tone?: "pink" | "mint" | "sky" | "butter";
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Sticker tone={tone} rotate={-3}>
        ✧ {hi} ✧
      </Sticker>
      <h2 className="font-display text-2xl text-ink md:text-3xl">{title}</h2>
      <span className="ml-1 select-none font-pixel text-sm tracking-widest text-ink/45">
        ✦ ★ ✧ ♡ ✦
      </span>
    </div>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dotted border-ink/25 py-1.5 last:border-b-0">
      <span className="font-pixel text-[11px] uppercase tracking-widest text-ink/65">
        {label}
      </span>
      <span className="font-body text-[14px] text-ink/90">{value}</span>
    </div>
  );
}

export function Docs({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-6 px-2 pb-6 pt-2">
      {/* docs hero */}
      <Frame className="relative overflow-hidden">
        <span className="absolute -top-2 left-6">
          <Tape rotate={-7}>✿ docs ✿</Tape>
        </span>
        <span className="absolute -top-2 right-6">
          <Tape rotate={6}>♡ v1 ♡</Tape>
        </span>
        <div className="flex flex-col gap-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sticker tone="pink" rotate={-3}>♡ HELLO ♡</Sticker>
            <Sticker tone="mint" rotate={4}>read me!!</Sticker>
            <Sticker tone="butter" rotate={-2}>v4 hook</Sticker>
          </div>
          <h1 className="font-display text-[34px] leading-[1.1] text-ink md:text-[44px]">
            how mochi garden works ♡
          </h1>
          <p className="max-w-[640px] font-body text-[15px] text-ink/85">
            a uniswap v4 hook game where every swap touches the garden and every garden
            action talks to the pool. this page explains the loop, the math, and where
            every fee goes ✿
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="kc-btn kc-btn-sky text-sm"
            >
              ← back to the garden
            </button>
            <a
              className="kc-btn kc-btn-butter text-sm no-underline"
              href="https://github.com/sp0oby/mochi#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              full readme on github ↗
            </a>
          </div>
        </div>
      </Frame>

      {/* the loop */}
      <Frame>
        <SectionHead hi="THE LOOP" title="buy → drip → cast → harvest" tone="pink" />
        <p className="mb-3 font-body text-[14.5px] text-ink/85">
          mochi.garden bolts a closed-economy garden game onto a real uniswap v4 pool.
          every <span className="font-display">ETH ⇄ MOCHI</span> swap goes through the
          same pool everyone else uses — the price is fully market-driven. the game
          quietly tags along on the hook.
        </p>
        <InnerFrame>
          <ol className="space-y-2 font-body text-[14px] text-ink/85">
            <li>
              <span className="kc-tape mr-2">1</span>
              <span className="font-display">buy MOCHI</span> through the pool. mochi-chan
              drips <span className="font-display">SEEDs</span> into your garden
              automatically (1 SEED per whole MOCHI).
            </li>
            <li>
              <span className="kc-tape mr-2">2</span>
              your <span className="font-display">gardeners</span> also produce SEEDs
              over time — 1 SEED / sec / gardener, capped at 1 day per cycle.
            </li>
            <li>
              <span className="kc-tape mr-2">3</span>
              <span className="font-display">cast</span> your accumulated SEEDs into more
              gardeners (1 gardener = 86,400 SEEDs).
            </li>
            <li>
              <span className="kc-tape mr-2">4</span>
              when ur ready: <span className="font-display">harvest</span> SEEDs back
              into MOCHI from the hook's treasury via the PSN/PSNH bonding curve. or
              just <span className="font-display">swap</span> ur MOCHI on the pool. ur
              choice ♡
            </li>
          </ol>
        </InnerFrame>
      </Frame>

      {/* tokens */}
      <Frame>
        <SectionHead hi="TOKENS & STATE" title="what's a token and what's a counter" tone="mint" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <InnerFrame>
            <div className="mb-2 font-display text-lg text-ink">$MOCHI ✿</div>
            <p className="font-body text-[13.5px] text-ink/80">
              real ERC20. paired with ETH in the v4 pool. 1B fixed supply. tradable,
              transferable, lp-able like any token.
            </p>
          </InnerFrame>
          <InnerFrame>
            <div className="mb-2 font-display text-lg text-ink">$SEED ✦</div>
            <p className="font-body text-[13.5px] text-ink/80">
              NOT a token!! it's a per-user counter inside the hook. not transferable.
              you cast SEEDs into gardeners or harvest them for MOCHI from the treasury.
            </p>
          </InnerFrame>
          <InnerFrame>
            <div className="mb-2 font-display text-lg text-ink">gardeners 🌱</div>
            <p className="font-body text-[13.5px] text-ink/80">
              a per-user count of little workers in your plot. each produces 1 SEED /
              sec until you cast or harvest. cast a fresh batch of SEEDs to mint more.
            </p>
          </InnerFrame>
          <InnerFrame>
            <div className="mb-2 font-display text-lg text-ink">treasury ♡</div>
            <p className="font-body text-[13.5px] text-ink/80">
              200M MOCHI held by the hook at deploy. funds every harvest payout via the
              PSN/PSNH curve. capped at 0.1% per single harvest — runway is years.
            </p>
          </InnerFrame>
        </div>
      </Frame>

      {/* the bonding curve */}
      <Frame>
        <SectionHead hi="HARVEST MATH" title="the PSN / PSNH bonding curve" tone="butter" />
        <p className="mb-3 font-body text-[14.5px] text-ink/85">
          when you <span className="font-display">sell()</span> SEEDs to the hook, MOCHI
          comes out via the original ponzi-game curve:
        </p>
        <InnerFrame className="overflow-x-auto">
          <pre className="font-pixel text-[12.5px] text-ink/85">
{`calculateTrade(rt, rs, bs)
  = (PSN × bs) / (PSNH + ((PSN × rs + PSNH × rt) / rt))`}
          </pre>
        </InnerFrame>
        <p className="mt-3 font-body text-[13.5px] text-ink/75">
          where <span className="font-display">bs</span> = treasury MOCHI,{" "}
          <span className="font-display">rs</span> = global marketSeeds,{" "}
          <span className="font-display">rt</span> = your SEEDs in. bigger treasury →
          better payout per seed; more market seeds → smaller payout (scarcity drops as
          everyone farms). same dynamic as the original eggs/beans loop, just denominated
          in MOCHI instead of ETH ✿
        </p>
      </Frame>

      {/* fees */}
      <Frame>
        <SectionHead hi="FEES" title="where every coin lands" tone="sky" />
        <div className="space-y-3">
          <InnerFrame>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Sticker tone="pink" rotate={-2}>swap ETH → MOCHI</Sticker>
              <span className="font-pixel text-[11px] tracking-widest text-ink/55">pool buy</span>
            </div>
            <Row label="protocol entry fee" value="1% of ETH input → treasury" />
            <Row label="lp fee (dynamic)" value="0.5% – 1.0% → liquidity providers" />
          </InnerFrame>
          <InnerFrame>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Sticker tone="mint" rotate={-2}>swap MOCHI → ETH</Sticker>
              <span className="font-pixel text-[11px] tracking-widest text-ink/55">pool sell</span>
            </div>
            <Row label="lp fee only" value="0.5% – 1.0% → liquidity providers" />
            <Row label="no protocol cut" value="treasury takes nothing on sells" />
          </InnerFrame>
          <InnerFrame>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Sticker tone="butter" rotate={-2}>hook.sell()</Sticker>
              <span className="font-pixel text-[11px] tracking-widest text-ink/55">game harvest</span>
            </div>
            <Row label="not a pool swap" value="hook transfers MOCHI from treasury" />
            <Row label="protocol harvest fee" value="1% of MOCHI payout → treasury" />
          </InnerFrame>
          <InnerFrame>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Sticker tone="cream" rotate={-2}>cast() referral</Sticker>
              <span className="font-pixel text-[11px] tracking-widest text-ink/55">one-time</span>
            </div>
            <Row label="bonus to referrer" value="12% of referee's first cast (in SEEDs)" />
            <Row label="ongoing cut" value="none — first cast only" />
          </InnerFrame>
        </div>
      </Frame>

      {/* dynamic fee + lp rebate */}
      <Frame>
        <SectionHead hi="DYNAMIC FEE" title="busy garden = pricier swaps" tone="pink" />
        <p className="mb-3 font-body text-[14.5px] text-ink/85">
          the hook overrides the pool's swap fee on every swap. quiet garden →{" "}
          <span className="font-display">0.5%</span>. peak farming →{" "}
          <span className="font-display">1.0%</span>. casual swappers eat a slightly
          steeper fee while the game is churning, so the pool stays liquid under load.
        </p>
        <InnerFrame>
          <Row label="base fee" value="5,000 bps (0.5%)" />
          <Row label="peak fee" value="10,000 bps (1.0%)" />
          <Row label="lp rebate" value="active LPs get 50% off their own swap fee" />
        </InnerFrame>
      </Frame>

      {/* auto-deepen flywheel */}
      <Frame>
        <SectionHead hi="FLYWHEEL" title="auto-deepen, every 5 ETH" tone="mint" />
        <p className="mb-3 font-body text-[14.5px] text-ink/85">
          every 5 ETH of cumulative mint inflow trips the auto-deepen: the hook commits{" "}
          <span className="font-display">0.1 ETH</span> + matching MOCHI from{" "}
          <span className="font-display">lpReserve</span> into a fresh lp position
          around current tick. small bites; lots of them. the curve gets deeper without
          anyone touching it ♡
        </p>
        <InnerFrame>
          <Row label="trigger" value="5 ETH cumulative mint inflow" />
          <Row label="amount" value="0.1 ETH + matching MOCHI per fire" />
          <Row label="lp reserve" value="75M MOCHI pre-funded at deploy" />
          <Row label="visible on" value="the stats bar — auto-deepen progress meter" />
        </InnerFrame>
      </Frame>

      {/* v4 architecture */}
      <Frame>
        <SectionHead hi="UNDER THE HOOD" title="which v4 callbacks fire when" tone="butter" />
        <InnerFrame>
          <Row label="beforeInitialize" value="lock pool to ETH/MOCHI + dynamic fee flag" />
          <Row label="beforeSwap" value="return the current dynamic fee (w/ lp rebate)" />
          <Row label="afterSwap" value="drip SEEDs to tx.origin on ETH → MOCHI buys" />
          <Row label="afterAddLiquidity" value="register tx.origin as active LP" />
          <Row label="afterRemoveLiquidity" value="untrack LP on full / partial remove" />
        </InnerFrame>
        <p className="mt-3 font-body text-[13px] text-ink/65">
          v1 note: tx.origin is used because routers wrap the EOA in the callback. works
          for EOA users; not for account-abstraction / smart-contract callers.
          documented + intentional for v1 ✦
        </p>
      </Frame>

      {/* gentle disclaimer */}
      <Frame className="bg-pink-50/60">
        <SectionHead hi="PLEASE READ" title="the boring but important bit" tone="pink" />
        <p className="font-body text-[14px] text-ink/85">
          this is a game!! a closed-economy compounding loop wrapped around a real DEX
          pool. it is <span className="font-display">not</span> an investment. payouts
          shrink as more SEEDs hit the market; the treasury can drain; the pool price
          can move against you. read the contracts, run it on testnet, and never play
          with more than you'd cheerfully feed to a roomba (◕‿◕✿)
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onBack} className="kc-btn kc-btn-mint text-sm">
            ← back to the garden ♡
          </button>
        </div>
      </Frame>
    </section>
  );
}
