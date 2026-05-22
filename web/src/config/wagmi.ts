import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { anvil, supportedChains } from "./chains";
import { base, baseSepolia } from "wagmi/chains";

// Project ID is optional for non-WC flows but RainbowKit asks for one. A placeholder
// works for MetaMask/browser-wallet flows only — WalletConnect needs a real ID.
const projectId = import.meta.env.VITE_WC_PROJECT_ID ?? "mochi-garden-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "Mochi Garden",
  projectId,
  chains: supportedChains as never,
  transports: {
    [anvil.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org"),
    [base.id]: http(import.meta.env.VITE_BASE_RPC ?? "https://mainnet.base.org"),
  },
  ssr: false,
});
