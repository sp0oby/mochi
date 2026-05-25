import type { ReactNode } from "react";

/** Outer nested-border kawaii frame. Lace-y feel via box-shadow stack from CSS. */
export function Frame({
  children,
  className = "",
  tilt = 0,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
}) {
  return (
    <div
      className={`kc-frame ${className}`}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {children}
    </div>
  );
}

export function InnerFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`kc-frame-inner ${className}`}>{children}</div>;
}

/** Tape strip — overlap on a frame seam with rotated -7 / 3 / 11 / 13. */
export function Tape({
  children,
  rotate = 11,
  className = "",
}: {
  children: ReactNode;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={`kc-tape ${className}`}
      style={{ display: "inline-block", transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** Sticker chip — for stats labels, status pills, tag-y bits. */
export function Sticker({
  children,
  tone = "pink",
  rotate = 0,
  className = "",
}: {
  children: ReactNode;
  tone?: "pink" | "mint" | "sky" | "butter" | "cream";
  rotate?: number;
  className?: string;
}) {
  const toneClass = {
    pink: "bg-pink-100",
    mint: "bg-mint-100",
    sky: "bg-sky-100",
    butter: "bg-butter-100",
    cream: "bg-cream",
  }[tone];
  return (
    <span
      className={`kc-sticker ${toneClass} ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {children}
    </span>
  );
}

/** Tamagotchi-style stat box */
export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="kc-stat flex flex-col overflow-hidden">
      <span className="truncate text-[10px] uppercase tracking-widest text-ink/55">{label}</span>
      <span className="truncate font-display text-lg leading-tight text-ink">{value}</span>
      {sub ? <span className="truncate text-[10px] text-ink/55">{sub}</span> : null}
    </div>
  );
}

/** A single twinkling sparkle. Place inside a relatively-positioned parent and
 *  set top/left/right/bottom via the style prop. Each sparkle randomizes its
 *  own duration + delay so the field doesn't pulse in unison. */
export function Sparkle({
  glyph = "✦",
  color = "#d97a8d",
  size = 12,
  className = "",
  style,
}: {
  glyph?: string;
  color?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Stable-ish randomness per render, deterministic enough that hydration
  // doesn't whine but varied enough that twinkles don't sync.
  const dur = 1.6 + Math.random() * 1.8;
  const delay = Math.random() * 1.5;
  return (
    <span
      aria-hidden
      className={`kc-sparkle absolute ${className}`}
      style={{
        color,
        fontSize: size,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ...({ "--kc-twinkle-dur": `${dur.toFixed(2)}s`, "--kc-twinkle-delay": `${delay.toFixed(2)}s` } as React.CSSProperties),
        ...style,
      }}
    >
      {glyph}
    </span>
  );
}

/** A row of small accessory glyphs — the decora "charm strip" under headings. */
export function AccessoryRow({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`kc-accessory-row ${className}`}>
      <span style={{ color: "#d97a8d" }}>♡</span>
      <span style={{ color: "#e8c34a" }}>✦</span>
      <span style={{ color: "#7ba05b" }}>✿</span>
      <span style={{ color: "#8aa07d" }}>★</span>
      <span style={{ color: "#d97a8d" }}>✧</span>
      <span style={{ color: "#e8c34a" }}>♥</span>
      <span style={{ color: "#7ba05b" }}>🌱</span>
      <span style={{ color: "#d97a8d" }}>♡</span>
    </div>
  );
}

/** Footer marquee — kept slow per kawaii-motion. */
export function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="kc-marquee relative w-full overflow-hidden border-y border-dotted border-ink/40">
      <div
        className="inline-block whitespace-nowrap will-change-transform"
        style={{ animation: "kc-marquee 32s linear infinite" }}
      >
        <span className="px-6">{children}</span>
        <span className="px-6">{children}</span>
        <span className="px-6">{children}</span>
      </div>
      <style>{`@keyframes kc-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
