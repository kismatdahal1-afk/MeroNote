import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { OTP_LENGTH } from "../../lib/otpFlow";

/**
 * Step 5 six-box OTP input (presentational, no network/storage).
 * Digits-only, mobile-friendly (`inputMode="numeric"`), paste-aware, and
 * keyboard-navigable. Styling reuses the shared auth input tokens.
 */

const BOX_CLASS =
  "h-12 w-full rounded-lg border border-border-strong bg-surface-muted text-center text-lg font-bold tracking-widest text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-[#3f4f65] dark:bg-[#2e3a4b]";

interface OtpInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, "");
}

export function OtpInput({ id = "otp", value, onChange, disabled }: OtpInputProps) {
  const boxesRef = useRef<Array<HTMLInputElement | null>>([]);

  const focusBox = (index: number): void => {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index));
    boxesRef.current[clamped]?.focus();
    boxesRef.current[clamped]?.select();
  };

  const handleBoxChange = (index: number, text: string): void => {
    if (disabled) return;
    const digits = onlyDigits(text);
    if (!digits) {
      // Clearing a box removes just that digit.
      onChange(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    if (digits.length === 1 && value[index]) {
      // Single-digit replace (focused box content was selected): keep the tail.
      const next = (value.slice(0, index) + digits + value.slice(index + 1)).slice(0, OTP_LENGTH);
      onChange(next);
      focusBox(index + 1 >= OTP_LENGTH ? OTP_LENGTH - 1 : index + 1);
      return;
    }
    // Fill forward from the edited box (typing into empty boxes, autofill).
    const next = (value.slice(0, index) + digits).slice(0, OTP_LENGTH);
    onChange(next);
    focusBox(next.length >= OTP_LENGTH ? OTP_LENGTH - 1 : next.length);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Backspace" && !e.currentTarget.value) {
      e.preventDefault();
      if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    const digits = onlyDigits(e.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (!digits) return;
    e.preventDefault();
    onChange(digits);
    focusBox(Math.min(digits.length, OTP_LENGTH - 1));
  };

  return (
    <div role="group" aria-label="6-digit verification code" onPaste={handlePaste}>
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              boxesRef.current[index] = node;
            }}
            id={`${id}-digit-${index}`}
            className={BOX_CLASS}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
            maxLength={1}
            value={value[index] ?? ""}
            disabled={disabled}
            onChange={(e) => handleBoxChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
