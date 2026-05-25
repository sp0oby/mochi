import { GardenerChan } from "../components/mochi/GardenerChan";
import { AccessoryRow, Frame, Sparkle, Sticker, Tape } from "../components/Primitives";

/** Pre-launch landing. Replaces the garden view when `isLaunched()` is false. */
export function Splash({ onDocs }: { onDocs: () => void }) {
  return (
    <section className="relative mt-2 flex flex-col items-center gap-6 px-2 pb-12 pt-8 text-center">
      {/* sparkle field */}
      <Sparkle glyph="✦" color="#d97a8d" size={20} style={{ top: 0, left: "8%" }} />
      <Sparkle glyph="✧" color="#e8c34a" size={14} style={{ top: 40, left: "22%" }} />
      <Sparkle glyph="★" color="#7ba05b" size={13} style={{ top: 90, left: "75%" }} />
      <Sparkle glyph="♡" color="#d97a8d" size={16} style={{ top: 18, right: "10%" }} />
      <Sparkle glyph="✦" color="#8aa07d" size={15} style={{ top: 160, right: "28%" }} />
      <Sparkle glyph="✧" color="#e8c34a" size={12} style={{ top: 200, left: "12%" }} />
      <Sparkle glyph="✦" color="#d97a8d" size={13} style={{ bottom: 80, right: "15%" }} />
      <Sparkle glyph="★" color="#7ba05b" size={11} style={{ bottom: 30, left: "20%" }} />
      <Sparkle glyph="✧" color="#d97a8d" size={14} style={{ bottom: 140, left: "5%" }} />
      <Sparkle glyph="♡" color="#e8c34a" size={12} style={{ bottom: 50, right: "8%" }} />

      <Frame className="relative w-full max-w-[820px]">
        <span className="absolute -top-3 left-8">
          <Tape rotate={-6}>✿ coming soon ✿</Tape>
        </span>
        <span className="absolute -top-3 right-8">
          <Tape rotate={7}>♡ v1 ♡</Tape>
        </span>

        <div className="flex flex-col items-center gap-4 pt-4">
          {/* stickers above the title */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Sticker tone="pink" rotate={-3}>♡ HELLO ♡</Sticker>
            <Sticker tone="mint" rotate={3}>launching on base</Sticker>
            <Sticker tone="butter" rotate={-2}>uniswap v4 hook</Sticker>
          </div>

          {/* big title — bubble letter technique via text-shadow */}
          <h1
            className="font-display text-[56px] leading-[1.0] text-ink md:text-[88px]"
            style={{
              textShadow:
                "3px 3px 0 #f4c0cc, -3px 3px 0 #f4c0cc, 3px -3px 0 #f4c0cc, -3px -3px 0 #f4c0cc",
            }}
          >
            mochi.garden
          </h1>

          <p className="max-w-[560px] font-body text-[16px] text-ink/85 md:text-[18px]">
            a kawaii on-chain garden game powered by a uniswap v4 hook.
            <br />
            buy mochi → grow gardeners → harvest seeds ♡
          </p>

          <AccessoryRow className="pt-1" />

          {/* mascot */}
          <div className="relative mt-2">
            <Sparkle glyph="✦" color="#d97a8d" size={18} style={{ top: 10, left: -20 }} />
            <Sparkle glyph="✧" color="#e8c34a" size={14} style={{ top: 60, right: -10 }} />
            <Sparkle glyph="★" color="#7ba05b" size={12} style={{ bottom: 30, left: -6 }} />
            <Sparkle glyph="♡" color="#d97a8d" size={14} style={{ bottom: 4, right: -16 }} />
            <div className="animate-bob" style={{ animationDelay: "200ms" }}>
              <GardenerChan size={260} mood="happy" />
            </div>
          </div>

          {/* tagline */}
          <div className="mt-2 inline-block rounded-md border-2 border-dashed border-ink/45 bg-cream-50/80 px-4 py-2 font-pixel text-[12px] uppercase tracking-[0.18em] text-ink/75">
            ♡ doors open soon ♡ stay tuned ♡
          </div>

          {/* CTAs */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="kc-btn kc-btn-sky text-sm" onClick={onDocs}>
              read the docs ✦
            </button>
            <a
              className="kc-btn kc-btn-mint text-sm no-underline"
              href="https://x.com/mochigardenbase"
              target="_blank"
              rel="noopener noreferrer"
            >
              follow on X ♡
            </a>
            <a
              className="kc-btn kc-btn-butter text-sm no-underline"
              href="https://github.com/sp0oby/mochi"
              target="_blank"
              rel="noopener noreferrer"
            >
              github ★
            </a>
          </div>

          <p className="mt-3 max-w-[520px] font-body text-[12px] text-ink/55">
            the contracts may already live on base, but the game isn&apos;t open yet.
            no minting, no harvesting, no liquidity adds until launch ♡ pls don&apos;t
            try to sneak in via etherscan, it won&apos;t do anything fun yet (◕‿◕✿)
          </p>
        </div>
      </Frame>
    </section>
  );
}
