import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../../lib/connectivity";

/**
 * Minimal offline indicator (Phase 9). Renders nothing while online, so the
 * layout is byte-identical in the normal case. Advisory only — requests
 * remain authoritative about real reachability.
 */
export function OfflineBadge() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <span
      role="status"
      aria-label="You are offline"
      className="inline-flex items-center gap-1 rounded-full bg-warning-muted px-2.5 py-1 text-xs font-bold text-warning"
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      Offline
    </span>
  );
}
