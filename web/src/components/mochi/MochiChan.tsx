import type { CSSProperties } from "react";

/**
 * Mochi-chan — the kawaiicore mascot for Mochi Garden.
 *
 * Sanrio brand-package rules applied:
 *   1. Round head, baby proportions, big eyes (cute substrate)
 *   2. ONE signature accessory — the straw sun hat
 *   3. ONE "wrong" element — the leaf is faintly oversized for the body
 *   4. ONE mood-reactive bit — the leaf hue shifts with SEED production rate
 *
 * `mood` drives the leaf hue (vibrant green = compounding fast).
 */
export type MochiMood = "idle" | "happy" | "sleepy" | "thinking";

export function MochiChan({
  size = 180,
  mood = "idle",
  className,
  style,
}: {
  size?: number;
  mood?: MochiMood;
  className?: string;
  style?: CSSProperties;
}) {
  const leafColor = {
    idle: "#a8c489",    // matcha-300
    happy: "#7ba05b",   // matcha-500 (vibrant)
    sleepy: "#c9dcb0",  // mint-200 (pale)
    thinking: "#4e6a4a", // moss (deeper, contemplative)
  }[mood];

  const eyeStyle = mood === "sleepy" ? "_ _" : "•";
  void eyeStyle; // computed for future variants

  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Mochi-chan, a round mochi mascot with a leaf and straw hat"
    >
      {/* soft drop shadow */}
      <ellipse cx="100" cy="178" rx="56" ry="6" fill="#2e3a2c" opacity="0.16" />

      {/* mochi body — slightly squat, off-round (the prime-rotation cute) */}
      <g transform="rotate(-3 100 110)">
        <ellipse cx="100" cy="115" rx="62" ry="56" fill="#f5ede0" stroke="#2e3a2c" strokeWidth="2.5" />
        {/* subtle blush */}
        <ellipse cx="70" cy="125" rx="9" ry="5" fill="#f4c0cc" opacity="0.85" />
        <ellipse cx="130" cy="125" rx="9" ry="5" fill="#f4c0cc" opacity="0.85" />
      </g>

      {/* leaf sprout — the "wrong" element, slightly too big. Outer <g> holds the
          positioning transform; inner <g> handles the wiggle so CSS-transform doesn't
          stomp the SVG translate/rotate. */}
      <g transform="translate(100 60)">
        <g className="animate-wiggle" style={{ transformOrigin: "0 40px", transformBox: "fill-box" }}>
          <path d="M0 40 C -22 18, -22 -8, 0 -28 C 22 -8, 22 18, 0 40 Z" fill={leafColor} stroke="#2e3a2c" strokeWidth="2.5" />
          <path d="M0 40 L 0 -18" stroke="#2e3a2c" strokeWidth="1.5" fill="none" />
          <path d="M0 12 L -10 -2" stroke="#2e3a2c" strokeWidth="1.2" fill="none" />
          <path d="M0 12 L 10 -2" stroke="#2e3a2c" strokeWidth="1.2" fill="none" />
        </g>
      </g>

      {/* straw sun hat — signature accessory. Deeper tan so it reads on cream bg. */}
      <g transform="translate(50 50)">
        <ellipse cx="50" cy="22" rx="58" ry="11" fill="#d9a667" stroke="#2e3a2c" strokeWidth="2.5" />
        <ellipse cx="50" cy="12" rx="30" ry="15" fill="#e8be83" stroke="#2e3a2c" strokeWidth="2.5" />
        {/* sakura hat band */}
        <rect x="22" y="20" width="56" height="6" fill="#d97a8d" stroke="#2e3a2c" strokeWidth="1" />
        <circle cx="78" cy="23" r="3.5" fill="#f4c0cc" stroke="#2e3a2c" strokeWidth="1" />
        {/* hat texture marks */}
        <line x1="35" y1="4" x2="40" y2="22" stroke="#a87a40" strokeWidth="1" />
        <line x1="50" y1="0" x2="50" y2="22" stroke="#a87a40" strokeWidth="1" />
        <line x1="65" y1="4" x2="60" y2="22" stroke="#a87a40" strokeWidth="1" />
      </g>

      {/* eyes — sparkle dots, with idle blink applied via container class */}
      <g className="origin-center animate-blink" style={{ transformOrigin: "100px 118px" }}>
        <ellipse cx="80" cy="118" rx="4.5" ry="6" fill="#2e3a2c" />
        <ellipse cx="120" cy="118" rx="4.5" ry="6" fill="#2e3a2c" />
        {/* highlight */}
        <circle cx="78.5" cy="116" r="1.2" fill="#fff" />
        <circle cx="118.5" cy="116" r="1.2" fill="#fff" />
      </g>

      {/* mouth — small w/ tiny smile */}
      <path
        d="M93 138 Q100 144 107 138"
        stroke="#2e3a2c"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* tiny sparkles around the leaf */}
      <text x="155" y="55" fontSize="14" fill="#d97a8d" className="pause-on-scroll" style={{ fontFamily: "Yusei Magic" }}>✿</text>
      <text x="35" y="70" fontSize="11" fill="#e8c34a">✦</text>
    </svg>
  );
}
