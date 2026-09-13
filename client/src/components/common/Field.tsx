import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/utils";

const FIELD_BASE =
  "w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:bg-surface";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className, ...rest }, ref) => (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(FIELD_BASE, "h-10", error && "border-error focus:border-error focus:ring-error/25")}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
    </div>
  ),
);
Input.displayName = "Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, id, className, ...rest }, ref) => (
    <div className={cx("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cx(FIELD_BASE, "h-10", error && "border-error focus:border-error focus:ring-error/25")}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
    </div>
  ),
);
Select.displayName = "Select";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className, ...rest }, ref) => (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        rows={4}
        className={cx(FIELD_BASE, "py-2.5", error && "border-error focus:border-error focus:ring-error/25")}
        {...rest}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
    </div>
  ),
);
Textarea.displayName = "Textarea";
