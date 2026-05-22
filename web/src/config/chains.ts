import { defineChain } from "viem";
import { base, baseSepolia } from "wagmi/chains";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export const supportedChains = [anvil, baseSepolia, base] as const;
