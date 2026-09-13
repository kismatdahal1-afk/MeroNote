import { X } from "lucide-react";
import { useUser } from "../../state/UserProvider";
import { SidebarNav } from "./Sidebar";
import { IconButton } from "../common/IconButton";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { name, email } = useUser();
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-border bg-surface shadow-xl">
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                {name}
              </span>
              <span className="text-xs font-medium text-muted-foreground">{email}</span>
            </div>
          </div>
          <IconButton icon={X} label="Close navigation menu" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
