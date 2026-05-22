import { useEffect, useMemo, useState } from "react";
import { isAddress, type Address, getAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";
import MochiHookAbi from "../abi/MochiHook.json";
import { useMochi } from "./useMochi";

const STORAGE_KEY = "mochi.garden.referrer";
const ZERO_ADDR: Address = "0x0000000000000000000000000000000000000000";

/// Reads ?ref=0x... from the URL on mount and persists it to localStorage.
/// Also reads the on-chain `referrerOf[user]` lock — if set, that wins over local state.
export function useReferral() {
  const { address: me } = useAccount();
  const { deployment } = useMochi();
  const [localReferrer, setLocalReferrer] = useState<Address | null>(null);

  // 1. Pull from URL on first mount, save to localStorage if valid.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref && isAddress(ref)) {
        const checksummed = getAddress(ref);
        window.localStorage.setItem(STORAGE_KEY, checksummed);
        setLocalReferrer(checksummed);
      } else {
        // No URL ref — read whatever's already persisted
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved && isAddress(saved)) {
          setLocalReferrer(getAddress(saved));
        }
      }
    } catch {
      // window unavailable in SSR — ignore
    }
  }, []);

  // 2. Read the on-chain lock for the connected wallet.
  const { data: onChainLock, refetch } = useReadContract({
    address: deployment?.hook,
    abi: MochiHookAbi as never,
    functionName: "referrerOf",
    args: me ? [me] : undefined,
    query: { enabled: !!me && !!deployment, refetchInterval: 6000 },
  });

  // Resolved referrer: on-chain lock wins; else local; else zero
  const lockedOnChain = useMemo(() => {
    if (!onChainLock) return ZERO_ADDR;
    return (onChainLock as Address) ?? ZERO_ADDR;
  }, [onChainLock]);

  const isLocked = lockedOnChain !== ZERO_ADDR;

  // The referrer arg to pass into cast(): lock if set, else local, else zero
  const referrerForCast: Address = isLocked
    ? lockedOnChain
    : localReferrer ?? ZERO_ADDR;

  // Build a share link for the connected user
  const shareLink = useMemo(() => {
    if (!me) return null;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("ref", me);
      return url.toString();
    } catch {
      return null;
    }
  }, [me]);

  function clearLocal() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setLocalReferrer(null);
  }

  // Detect self-referral so we can show a hint and not send the arg
  const isSelfReferral = !!me && (referrerForCast.toLowerCase() === me.toLowerCase());
  const effectiveReferrer: Address = isSelfReferral ? ZERO_ADDR : referrerForCast;

  return {
    /** Address you want to pass into cast(). Already enforces self-referral → 0. */
    referrer: effectiveReferrer,
    /** The on-chain lock (or 0x0 if no lock yet). */
    lockedOnChain,
    /** True if the user has a permanent on-chain referrer set. */
    isLocked,
    /** The raw URL/localStorage value, even if it would be ignored on-chain. */
    pendingLocal: localReferrer,
    /** True if the local/url referrer is self — UI hint. */
    isSelfReferral,
    /** A shareable URL containing the user's address as `?ref=`. */
    shareLink,
    refetch,
    clearLocal,
  };
}
