/// Local-storage backed position registry. We need this because the test routers we
/// use (PoolModifyLiquidityTest) don't mint position NFTs — liquidity is identified
/// by (owner, tickLower, tickUpper, salt). Without an NFT we have no way to know
/// what positions a user has unless we track them client-side.

import { type Address } from "viem";

export type Position = {
  tickLower: number;
  tickUpper: number;
  liquidity: string; // bigint as decimal string for JSON
  salt: `0x${string}`;
  addedAt: number; // unix seconds
};

function key(chainId: number, owner: Address): string {
  return `mochi.lp.${chainId}.${owner.toLowerCase()}`;
}

export function getPositions(chainId: number, owner: Address): Position[] {
  try {
    const raw = window.localStorage.getItem(key(chainId, owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Position[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addPosition(chainId: number, owner: Address, pos: Position): void {
  const cur = getPositions(chainId, owner);
  cur.push(pos);
  try {
    window.localStorage.setItem(key(chainId, owner), JSON.stringify(cur));
  } catch {
    // ignore
  }
}

export function removePosition(chainId: number, owner: Address, idx: number): void {
  const cur = getPositions(chainId, owner);
  cur.splice(idx, 1);
  try {
    window.localStorage.setItem(key(chainId, owner), JSON.stringify(cur));
  } catch {
    // ignore
  }
}
