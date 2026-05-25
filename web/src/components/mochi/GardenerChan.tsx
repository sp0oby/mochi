import type { CSSProperties } from "react";

/**
 * Gardener-chan — the chibi gardener mascot that lives in the hero.
 * Same brand-package rules as MochiChan, different silhouette:
 *   1. Round head, baby proportions, big eyes
 *   2. ONE signature accessory — the watering can
 *   3. ONE "wrong" element — the leaf umbrella tilts at a too-cute angle
 *   4. Mood-reactive bit: leaf hue shifts with the garden rate
 *
 * `mood` mirrors MochiMood so callers can pass the same value.
 */
export type GardenerMood = "idle" | "happy" | "sleepy" | "thinking";

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
  const leafColor = {
    idle: "#a8c489",
    happy: "#7ba05b",
    sleepy: "#c9dcb0",
    thinking: "#4e6a4a",
  }[mood];

  // soft palette pulls
  const skin = "#f8e8d4";
  const hair = "#6b4a3a";
  const hatBrim = "#d9a667";
  const hatCrown = "#e8be83";
  const overall = "#bccab2";
  const strap = "#a8c489";
  const can = "#f4c0cc";
  const ink = "#2e3a2c";

  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Gardener-chan, a tiny chibi gardener in overalls with a watering can"
    >
      {/* soft ground shadow */}
      <ellipse cx="100" cy="184" rx="56" ry="6" fill={ink} opacity="0.16" />

      {/* leaf sprig sprouting behind the hat (the wiggling "wrong-sized" element) */}
      <g
        className="animate-wiggle"
        style={{ transformOrigin: "150px 60px", transformBox: "fill-box" }}
      >
        <g transform="translate(150 60) rotate(20)">
          <path
            d="M0 22 C -14 8, -14 -10, 0 -22 C 14 -10, 14 8, 0 22 Z"
            fill={leafColor}
            stroke={ink}
            strokeWidth="2.4"
          />
          <path d="M0 22 L 0 -12" stroke={ink} strokeWidth="1.4" fill="none" />
          <path d="M0 6 L -8 -2" stroke={ink} strokeWidth="1.1" fill="none" />
          <path d="M0 6 L 8 -2" stroke={ink} strokeWidth="1.1" fill="none" />
        </g>
      </g>

      {/* head + body group — slight off-axis tilt for the off-round cute */}
      <g transform="rotate(-2 100 110)">
        {/* hair (bob) under the hat brim */}
        <path
          d="M58 76 Q60 50 100 44 Q140 50 142 76 L142 96 Q126 90 100 90 Q74 90 58 96 Z"
          fill={hair}
          stroke={ink}
          strokeWidth="2.4"
        />

        {/* head */}
        <ellipse cx="100" cy="88" rx="38" ry="36" fill={skin} stroke={ink} strokeWidth="2.4" />

        {/* side hair tufts */}
        <path
          d="M64 88 Q60 102 70 110 L76 102 Z"
          fill={hair}
          stroke={ink}
          strokeWidth="1.6"
        />
        <path
          d="M136 88 Q140 102 130 110 L124 102 Z"
          fill={hair}
          stroke={ink}
          strokeWidth="1.6"
        />

        {/* straw sun-hat brim */}
        <ellipse cx="100" cy="58" rx="56" ry="10" fill={hatBrim} stroke={ink} strokeWidth="2.4" />
        {/* crown */}
        <ellipse cx="100" cy="46" rx="28" ry="14" fill={hatCrown} stroke={ink} strokeWidth="2.4" />
        {/* hat texture lines */}
        <line x1="86" y1="36" x2="88" y2="58" stroke="#a87a40" strokeWidth="1.2" />
        <line x1="100" y1="32" x2="100" y2="58" stroke="#a87a40" strokeWidth="1.2" />
        <line x1="114" y1="36" x2="112" y2="58" stroke="#a87a40" strokeWidth="1.2" />
        {/* sakura band */}
        <rect x="72" y="54" width="56" height="6" fill="#d97a8d" stroke={ink} strokeWidth="0.8" />
        <circle cx="124" cy="57" r="3.5" fill="#f4c0cc" stroke={ink} strokeWidth="1" />

        {/* cheeks */}
        <ellipse cx="80" cy="100" rx="6" ry="3.4" fill="#f4c0cc" opacity="0.9" />
        <ellipse cx="120" cy="100" rx="6" ry="3.4" fill="#f4c0cc" opacity="0.9" />

        {/* eyes — blink applied via container class, same as MochiChan */}
        <g className="animate-blink" style={{ transformOrigin: "100px 92px" }}>
          <ellipse cx="86" cy="92" rx="4" ry="5.4" fill={ink} />
          <ellipse cx="114" cy="92" rx="4" ry="5.4" fill={ink} />
          <circle cx="84.8" cy="90.5" r="1.2" fill="#fff" />
          <circle cx="112.8" cy="90.5" r="1.2" fill="#fff" />
        </g>

        {/* tiny smile */}
        <path
          d="M92 110 Q100 116 108 110"
          stroke={ink}
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* body: overalls */}
        <path
          d="M66 128 Q66 124 70 124 L130 124 Q134 124 134 128 L138 168 Q138 174 132 174 L68 174 Q62 174 62 168 Z"
          fill={overall}
          stroke={ink}
          strokeWidth="2.4"
        />
        {/* overall straps */}
        <rect x="78" y="124" width="5" height="14" fill={strap} stroke={ink} strokeWidth="0.8" />
        <rect x="117" y="124" width="5" height="14" fill={strap} stroke={ink} strokeWidth="0.8" />
        {/* overall button */}
        <circle cx="100" cy="142" r="3" fill="#e8c34a" stroke={ink} strokeWidth="0.8" />

        {/* left arm reaching to the watering can */}
        <path
          d="M66 134 Q48 144 38 158"
          stroke={ink}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* tiny hand */}
        <circle cx="38" cy="158" r="4.5" fill={skin} stroke={ink} strokeWidth="2" />

        {/* right arm at side */}
        <path
          d="M134 134 Q150 146 146 168"
          stroke={ink}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="146" cy="168" r="4.5" fill={skin} stroke={ink} strokeWidth="2" />
      </g>

      {/* watering can — signature accessory */}
      <g transform="translate(8 150)">
        {/* body */}
        <rect x="0" y="6" width="36" height="28" rx="3" fill={can} stroke={ink} strokeWidth="2.4" />
        {/* spout */}
        <path d="M36 12 L 56 6 L 56 18 L 36 22 Z" fill={can} stroke={ink} strokeWidth="2.2" />
        {/* handle */}
        <path
          d="M6 6 Q18 -4 30 6"
          stroke={ink}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* spout rosette */}
        <circle cx="56" cy="12" r="2" fill={ink} opacity="0.4" />
        {/* a few sparkly water drops */}
        <circle cx="62" cy="4" r="2.2" fill="#8aa07d" />
        <circle cx="66" cy="11" r="1.6" fill="#8aa07d" />
        <circle cx="60" cy="17" r="1.4" fill="#8aa07d" />
      </g>

      {/* corner sparkles */}
      <text x="170" y="32" fontSize="14" fill="#d97a8d" style={{ fontFamily: "'Yusei Magic', serif" }}>
        ✿
      </text>
      <text x="14" y="48" fontSize="11" fill="#e8c34a" style={{ fontFamily: "'Yusei Magic', serif" }}>
        ✦
      </text>
      <text x="180" y="120" fontSize="10" fill="#7ba05b" style={{ fontFamily: "'Yusei Magic', serif" }}>
        ★
      </text>
    </svg>
  );
}
