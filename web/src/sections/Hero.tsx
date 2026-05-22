import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MochiChan } from "../components/mochi/MochiChan";
import { Sticker, Tape } from "../components/Primitives";
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

      <section className="grid grid-cols-1 items-center gap-6 px-2 pb-6 pt-4 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[40px] leading-[1.05] text-ink md:text-[56px]">
            welcome to mochi garden ♡
          </h1>
          <p className="max-w-[560px] font-body text-[15px] text-ink/85">
            a uniswap v4 hook game. buy mochi → grow gardeners → harvest seeds → cast more
            gardeners. tiny mochi-chan tends the plots while u sleep 🌱 (◕‿◕✿)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Sticker tone="pink" rotate={3}>$MOCHI</Sticker>
            <Sticker tone="mint" rotate={-4}>$SEED (in-game)</Sticker>
            <Sticker tone="sky" rotate={11}>uniswap v4 hook</Sticker>
          </div>
        </div>
        <div className="flex items-center justify-center md:justify-end">
          <div className="relative animate-bob" style={{ animationDelay: "200ms" }}>
            <MochiChan size={260} mood="happy" />
          </div>
        </div>
      </section>
    </>
  );
}
