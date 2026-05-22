import { useMochi } from "../hooks/useMochi";
import { Marquee } from "../components/Primitives";
import { truncAddr } from "../lib/format";
import { addressUrl, getChainName } from "../lib/explorers";

export function Footer() {
  const { chainId, deployment } = useMochi();

  function addrLink(addr?: string) {
    if (!addr) return <span>—</span>;
    const url = addressUrl(chainId, addr);
    if (!url) return <span className="font-pixel">{truncAddr(addr)}</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-pixel underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        {truncAddr(addr)}
      </a>
    );
  }

  return (
    <footer className="mt-8 space-y-3 pb-10 text-center text-ink/60">
      <Marquee>
        ✿ welcome to mochi garden ✿ a uniswap v4 hook game ✿ buy mochi ✿ grow gardeners ✿
        harvest seeds ✿ pls don&apos;t step on the plants 🌱 ✿
      </Marquee>
      <div className="font-pixel text-[11px] uppercase tracking-widest">
        ♡ chain: <span className="font-pixel">{getChainName(chainId)}</span> ✦ hook:{" "}
        {addrLink(deployment?.hook)} ✦ mochi: {addrLink(deployment?.mochi)} ♡
      </div>
      <div className="font-body text-[12px]">
        built with care ★ tested on anvil first ★ best viewed in firefox lol
        <br />
        (づ｡◕‿‿◕｡)づ tysm for stopping by
      </div>
    </footer>
  );
}
