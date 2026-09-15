import { Check } from "lucide-react";
import { cx } from "../../lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  const id = `toggle-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        checked ? "bg-primary" : "bg-border-strong",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "absolute top-0.5 left-0.5 flex size-5 items-center justify-center rounded-full bg-surface text-primary shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      >
        {checked && <Check className="size-3 text-primary" aria-hidden="true" />}
      </span>
    </button>
  );
}