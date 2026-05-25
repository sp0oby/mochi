/**
 * Launch flag. The app has two modes:
 *
 *   - splash:  pre-launch landing page only. Mint / pool / liquidity / stats
 *              are hidden. Docs still accessible (#docs). Socials still
 *              shareable. Use this while contracts are on mainnet but
 *              you don't want anyone interacting via the public frontend.
 *
 *   - open:    the real app. Garden, mint, pool, liquidity, stats all live.
 *
 * To open the gate, flip LAUNCH_OPEN to `true` below and redeploy. The env
 * var `VITE_LAUNCH_OPEN=true` and the URL query `?preview=1` both also
 * force "open" mode, which is useful for previewing a production build
 * without having to flip the source flag.
 */
const LAUNCH_OPEN = false;

export function isLaunched(): boolean {
  if (LAUNCH_OPEN) return true;
  if (import.meta.env.VITE_LAUNCH_OPEN === "true") return true;
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.has("preview")) return true;
  }
  return false;
}
