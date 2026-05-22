import { Hero } from "./sections/Hero";
import { Garden } from "./sections/Garden";
import { Mint } from "./sections/Mint";
import { Pool } from "./sections/Pool";
import { Liquidity } from "./sections/Liquidity";
import { Stats } from "./sections/Stats";
import { Footer } from "./sections/Footer";
import { useMochi } from "./hooks/useMochi";
import { Sticker } from "./components/Primitives";
import { PriceMismatchBanner } from "./components/PriceMismatchBanner";

function NetworkBanner() {
  const { chainId, deployment } = useMochi();
  if (!chainId) return null;
  if (deployment) return null;
  return (
    <div className="mx-auto mb-3 max-w-[1100px] rounded-md border-2 border-dashed border-pink-500 bg-pink-50 px-4 py-2 text-center text-sm text-pink-500">
      <Sticker tone="pink" rotate={-4}>oh no</Sticker>{" "}
      mochi garden isn&apos;t deployed on chain {chainId} yet — switch to Anvil (31337) for now ♡
    </div>
  );
}

export default function App() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-6">
      <NetworkBanner />
      <PriceMismatchBanner />
      <Hero />
      <div className="my-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <Mint />
        <Pool />
      </div>
      <div className="my-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <Garden />
        <Liquidity />
      </div>
      <Stats />
      <Footer />
    </main>
  );
}
