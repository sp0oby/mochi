import { useMochi } from "../hooks/useMochi";
import { txUrl } from "../lib/explorers";

/// Renders a transaction hash as a short clickable link to the chain's block
/// explorer. Falls back to plain text if the chain has no known explorer.
export function TxLink({
  hash,
  label,
}: {
  hash: string;
  label?: string;
}) {
  const { chainId } = useMochi();
  const url = txUrl(chainId, hash);
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  const display = label ?? short;
  if (!url) return <span className="font-pixel">{display}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-pixel text-ink/80 underline decoration-dotted underline-offset-2 hover:text-ink"
    >
      {display}
    </a>
  );
}
