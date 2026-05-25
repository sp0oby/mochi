import { ConnectButton } from "@rainbow-me/rainbowkit";
import { GardenerChan } from "../components/mochi/GardenerChan";
import { AccessoryRow, Sparkle, Sticker, Tape } from "../components/Primitives";
import { truncAddr } from "../lib/format";

export function Hero() {
  return (
    <>
      {/* top bar — site mark on the left, wallet connect on the right */}
      <header className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-ink">mochi.garden</span>
          <Tape rotate={-7}>✿ v1 ✿</Tape>
        </div>
        <ConnectButton.Custom>
          {({ account, mounted, openAccountModal, openConnectModal }) => {
            const ready = mounted;
            return (
              <button
                type="button"
                className="kc-btn kc-btn-mint text-sm"
                onClick={() => {
                  if (!ready) return;
                  if (account) openAccountModal();
                  else openConnectModal();
                }}
                style={{ opacity: ready ? 1 : 0 }}
                aria-hidden={!ready}
              >
                {account ? truncAddr(account.address) : "connect wallet ♡"}
              </button>
            );
          }}
        </ConnectButton.Custom>
      </header>

      <section className="relative grid grid-cols-1 items-center gap-6 px-2 pb-6 pt-4 md:grid-cols-[minmax(0,1fr)_300px]">
        {/* sparkle field — purely decorative, sits behind the content */}
        <Sparkle glyph="✦" color="#d97a8d" size={16} style={{ top: 6, left: 10 }} />
        <Sparkle glyph="✧" color="#e8c34a" size={12} style={{ top: 22, left: 180 }} />
        <Sparkle glyph="★" color="#7ba05b" size={11} style={{ top: 64, left: 320 }} />
        <Sparkle glyph="✦" color="#8aa07d" size={14} style={{ top: 6, right: 14 }} />
        <Sparkle glyph="♡" color="#d97a8d" size={13} style={{ top: 110, right: 40 }} />
        <Sparkle glyph="✧" color="#e8c34a" size={10} style={{ bottom: 22, left: 90 }} />
        <Sparkle glyph="✦" color="#d97a8d" size={11} style={{ bottom: 6, right: 120 }} />

        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[40px] leading-[1.05] text-ink md:text-[56px]">
            welcome to mochi garden ♡
          </h1>
          <AccessoryRow className="pt-1" />
          <p className="max-w-[560px] font-body text-[15px] text-ink/85">
            a uniswap v4 hook game. buy mochi → grow gardeners → harvest seeds → cast more
            gardeners. niwa-chan tends the plots while u sleep 🌱 (◕‿◕✿)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Sticker tone="pink" rotate={3}>$MOCHI</Sticker>
            <Sticker tone="mint" rotate={-4}>$SEED (in-game)</Sticker>
            <Sticker tone="sky" rotate={11}>uniswap v4 hook</Sticker>
          </div>
        </div>
        <div className="relative flex items-center justify-center md:justify-end">
          {/* sparkle cluster around the mascot */}
          <Sparkle glyph="✦" color="#d97a8d" size={16} style={{ top: 4, left: 10 }} />
          <Sparkle glyph="✧" color="#e8c34a" size={12} style={{ top: 40, right: 6 }} />
          <Sparkle glyph="★" color="#7ba05b" size={11} style={{ bottom: 30, left: 4 }} />
          <Sparkle glyph="♡" color="#d97a8d" size={13} style={{ bottom: 4, right: 30 }} />
          <div className="relative animate-bob" style={{ animationDelay: "200ms" }}>
            <GardenerChan size={280} mood="happy" />
          </div>
        </div>
      </section>
    </>
  );
}
