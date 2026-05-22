/// Per-chain block explorer registry. Used by the footer + TxLink so addresses
/// and tx hashes link to the right explorer regardless of which chain wagmi is on.

export type ChainInfo = {
  name: string;
  explorer: string; // base URL with NO trailing slash; empty string = no explorer
};

export const CHAIN_INFO: Record<number, ChainInfo> = {
  1: { name: "Ethereum", explorer: "https://etherscan.io" },
  8453: { name: "Base", explorer: "https://basescan.org" },
  84532: { name: "Base Sepolia", explorer: "https://sepolia.basescan.org" },
  31337: { name: "Anvil", explorer: "" },
};

export function getExplorer(chainId: number | undefined | null): string {
  if (chainId == null) return "";
  return CHAIN_INFO[chainId]?.explorer ?? "";
}

export function getChainName(chainId: number | undefined | null): string {
  if (chainId == null) return "—";
  return CHAIN_INFO[chainId]?.name ?? String(chainId);
}

export function txUrl(chainId: number | undefined | null, hash: string): string {
  const ex = getExplorer(chainId);
  return ex ? `${ex}/tx/${hash}` : "";
}

export function addressUrl(chainId: number | undefined | null, address: string): string {
  const ex = getExplorer(chainId);
  return ex ? `${ex}/address/${address}` : "";
}
