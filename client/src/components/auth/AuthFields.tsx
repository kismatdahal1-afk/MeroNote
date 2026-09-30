import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * Shared presentational fields for the Login / Register forms (UI-only).
 * Every class, id, aria attribute, and autocomplete value matches the
 * original per-page markup exactly — this file only removes duplication.
 */

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-[#3f4f65] dark:bg-[#2e3a4b]";

const TOGGLE_CLASS =
  "absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

const SUBMIT_CLASS =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

/** Labeled text/email input with the shared auth input styling. */
export function AuthField({ id, label, className, ...rest }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input id={id} className={className ? `${INPUT_CLASS} ${className}` : INPUT_CLASS} {...rest} />
    </div>
  );
}

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  showPassword: boolean;
  onTogglePassword: () => void;
}

/** Password input with the shared visibility toggle button. */
export function PasswordField({
  id,
  label,
  showPassword,
  onTogglePassword,
  ...rest
}: PasswordFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          className={`${INPUT_CLASS} pr-11`}
          {...rest}
        />
        <button
          type="button"
          onClick={onTogglePassword}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className={TOGGLE_CLASS}
        >
          {showPassword ? (
            <EyeOff className="size-4.5" aria-hidden="true" />
          ) : (
            <Eye className="size-4.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

/** Form-level error line; renders nothing when there is no message. */
export function AuthFormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm font-medium text-error">
      {message}
    </p>
  );
}

interface AuthSubmitProps {
  busy: boolean;
  busyLabel: string;
  disabled?: boolean;
  children: ReactNode;
}

/** Primary auth submit button with built-in loading state. */
export function AuthSubmit({ busy, busyLabel, disabled, children }: AuthSubmitProps) {
  return (
    <button type="submit" disabled={disabled} className={SUBMIT_CLASS}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {busy ? busyLabel : children}
    </button>
  );
}
