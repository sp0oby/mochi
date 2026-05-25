import type { ReactNode } from "react";
import { useMochi } from "../hooks/useMochi";
import { Marquee, Sticker } from "../components/Primitives";
import { truncAddr } from "../lib/format";
import { addressUrl, getChainName } from "../lib/explorers";

/** Edit these once you have the real handles / repo. PRs welcome ♡ */
const X_URL = "https://x.com/YOUR_HANDLE";
const GITHUB_URL = "https://github.com/YOUR_HANDLE/mochi";

function CharmLink({
  href,
  label,
  icon,
  tone,
  external = true,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tone: "pink" | "mint" | "sky" | "butter";
  external?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const toneClass = {
    pink: "bg-pink-100 hover:bg-pink-200",
    mint: "bg-mint-100 hover:bg-mint-200",
    sky: "bg-sky-100 hover:bg-sky-200",
    butter: "bg-butter-100 hover:bg-butter-200",
  }[tone];
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 rounded-[12px] border-2 border-ink/80 ${toneClass} px-3 py-1.5 font-display text-[13px] text-ink no-underline shadow-sticker transition-transform hover:-translate-y-[1px] hover:rotate-[2deg]`}
    >
      <span aria-hidden className="inline-block">
        {icon}
      </span>
      <span>{label}</span>
    </a>
  );
}

export function Footer({
  view = "garden",
  onNavGarden,
  onNavDocs,
}: {
  view?: "garden" | "docs";
  onNavGarden?: () => void;
  onNavDocs?: () => void;
} = {}) {
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
    <footer className="mt-8 space-y-4 pb-10 text-center text-ink/60">
      <Marquee>
        ✿ welcome to mochi garden ✿ a uniswap v4 hook game ✿ buy mochi ✿ grow gardeners ✿
        harvest seeds ✿ pls don&apos;t step on the plants 🌱 ✿
      </Marquee>

      {/* charm-bracelet link row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <CharmLink
          href="#docs"
          label="docs"
          icon="✦"
          tone="sky"
          external={false}
          onClick={(e) => {
            if (onNavDocs) {
              e.preventDefault();
              onNavDocs();
            }
          }}
        />
        <span aria-hidden className="font-pixel text-xs text-ink/40">— ✦ —</span>
        <CharmLink href={X_URL} label="x / twitter" icon="✕" tone="pink" />
        <span aria-hidden className="font-pixel text-xs text-ink/40">— ♡ —</span>
        <CharmLink href={GITHUB_URL} label="github" icon="★" tone="mint" />
        {view === "docs" && onNavGarden ? (
          <>
            <span aria-hidden className="font-pixel text-xs text-ink/40">— ✿ —</span>
            <CharmLink
              href="#"
              label="garden"
              icon="🌱"
              tone="butter"
              external={false}
              onClick={(e) => {
                e.preventDefault();
                onNavGarden();
              }}
            />
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Sticker tone="cream" rotate={-3} className="text-[11px]">
          ♡ tysm for stopping by
        </Sticker>
      </div>

      <div className="font-pixel text-[11px] uppercase tracking-widest">
        ♡ chain: <span className="font-pixel">{getChainName(chainId)}</span> ✦ hook:{" "}
        {addrLink(deployment?.hook)} ✦ mochi: {addrLink(deployment?.mochi)} ♡
      </div>
      <div className="font-body text-[12px]">
        watered by niwa-chan ★ audited by mochi-chan ★ powered by uniswap v4
        <br />
        (づ｡◕‿‿◕｡)づ have a sweet one ✿
      </div>
    </footer>
  );
}
