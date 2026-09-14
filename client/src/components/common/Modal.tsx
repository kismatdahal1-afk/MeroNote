import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50"
    >
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        className="relative h-full overflow-y-auto overscroll-contain"
        onClick={onClose}
      >
        <div className="flex min-h-full justify-center p-4">
          <div
            onClick={(e) => e.stopPropagation()}
            className={cx(
              "card-glow relative my-auto w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl",
              className,
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">{children}</div>
            {footer && <div className="mt-6 flex shrink-0 justify-end gap-3">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
