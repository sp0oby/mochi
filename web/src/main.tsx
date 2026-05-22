import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { wagmiConfig } from "./config/wagmi";
import "./index.css";
import App from "./App";

const queryClient = new QueryClient();

const kawaiiTheme = lightTheme({
  accentColor: "#7ba05b",
  accentColorForeground: "#f5f0e1",
  borderRadius: "medium",
  fontStack: "system",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={kawaiiTheme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
