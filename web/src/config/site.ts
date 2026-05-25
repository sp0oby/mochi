/**
 * Canonical public URL for the site. Used wherever we need to print a
 * shareable link (referral URLs, copy-to-clipboard buttons, etc.) so the
 * link is always `mochigarden.xyz` regardless of whether the user is
 * browsing the production domain, a vercel preview, localhost, etc.
 *
 * Override with VITE_SITE_URL at build time if the production host changes.
 */
export const SITE_URL: string =
  import.meta.env.VITE_SITE_URL ?? "https://mochigarden.xyz";
