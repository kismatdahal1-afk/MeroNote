import { X } from "lucide-react";
import { mockUser } from "../../data/mock";
import { SidebarNav } from "./Sidebar";
import { IconButton } from "../common/IconButton";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">
              AS
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {mockUser.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{mockUser.email}</span>
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
