import type { CSSProperties } from "react";

/**
 * Gardener-chan (niwa-chan) — the pixel-art gardener mascot that lives in the
 * hero and splash. She's a crisp pixel sprite (straw hat + sakura, brown bob,
 * green overalls, pink watering can), so we render her nearest-neighbour to keep
 * the chunky pixels sharp at any size.
 *
 * `size` controls her on-screen HEIGHT; width follows the sprite's aspect ratio.
 * `mood` is kept for API compatibility with MochiChan and tweaks her tint a touch.
 */
export type GardenerMood = "idle" | "happy" | "sleepy" | "thinking";

const SPRITE = "/niwa-chan.png";
const ASPECT = 992 / 974; // sprite is ~square (w / h)

export function GardenerChan({
  size = 260,
  mood = "happy",
  className,
  style,
}: {
  size?: number;
  mood?: GardenerMood;
  className?: string;
  style?: CSSProperties;
}) {
  // subtle mood tint so callers passing different moods get a little feedback
  const filter = {
    idle: undefined,
    happy: "saturate(1.05)",
    sleepy: "saturate(0.85) brightness(1.03)",
    thinking: "saturate(0.95)",
  }[mood];

  return (
    <img
      src={SPRITE}
      className={className}
      width={Math.round(size * ASPECT)}
      height={size}
      style={{
        imageRendering: "pixelated",
        // crisp pixel art — also helps Safari/Firefox
        WebkitFontSmoothing: "none",
        filter,
        ...style,
      }}
      alt="Niwa-chan, a tiny pixel gardener in a straw hat and overalls holding a watering can"
      draggable={false}
    />
  );
}
