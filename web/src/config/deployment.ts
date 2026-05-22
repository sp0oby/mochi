import anvilJson from "./deployments/31337.json";
import baseSepoliaJson from "./deployments/84532.json";
import { type Address } from "viem";

export type Deployment = {
  chainId: number;
  poolManager: Address;
  mochi: Address;
  hook: Address;
  devTreasury: Address;
  liquidityRouter: Address;
  swapRouter: Address;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
};

const ZERO = "0x0000000000000000000000000000000000000000";

function valid(d: Deployment | undefined): boolean {
  if (!d) return false;
  return d.hook !== ZERO && d.mochi !== ZERO && d.poolManager !== ZERO;
}

const registry: Record<number, Deployment> = {
  31337: anvilJson as Deployment,
  84532: baseSepoliaJson as Deployment,
};

export function getDeployment(chainId: number | undefined): Deployment | null {
  if (chainId === undefined) return null;
  const d = registry[chainId];
  if (!valid(d)) return null;
  return d;
}
