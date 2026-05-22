import { useChainId } from "wagmi";
import { getDeployment } from "../config/deployment";

export function useMochi() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  return { chainId, deployment };
}
