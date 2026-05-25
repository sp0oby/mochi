import { useCallback, useEffect, useState } from "react";
import { Hero } from "./sections/Hero";
import { Garden } from "./sections/Garden";
import { Mint } from "./sections/Mint";
import { Pool } from "./sections/Pool";
import { Liquidity } from "./sections/Liquidity";
import { Stats } from "./sections/Stats";
import { Footer } from "./sections/Footer";
import { Docs } from "./sections/Docs";
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
      mochi garden isn&apos;t deployed on chain {chainId} yet — try Base (8453), Base Sepolia (84532), or Anvil (31337) ♡
    </div>
  );
}

type View = "garden" | "docs";

function readViewFromHash(): View {
  return typeof window !== "undefined" && window.location.hash === "#docs" ? "docs" : "garden";
}

export default function App() {
  const [view, setView] = useState<View>(readViewFromHash);

  useEffect(() => {
    function onHashChange() {
      setView(readViewFromHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const targetHash = view === "docs" ? "#docs" : "";
    if (window.location.hash !== targetHash) {
      const url = `${window.location.pathname}${window.location.search}${targetHash}`;
      window.history.replaceState(null, "", url);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  const goDocs = useCallback(() => setView("docs"), []);
  const goGarden = useCallback(() => setView("garden"), []);

  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-6">
      <NetworkBanner />
      <PriceMismatchBanner />
      {view === "garden" ? (
        <>
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
        </>
      ) : (
        <Docs onBack={goGarden} />
      )}
      <Footer view={view} onNavGarden={goGarden} onNavDocs={goDocs} />
    </main>
  );
}
