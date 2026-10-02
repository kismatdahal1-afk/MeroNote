import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../state/ToastProvider";
import { useUser } from "../state/UserProvider";
import { AuthError } from "../lib/authApi";
import { AuthFormError, AuthSubmit } from "../components/auth/AuthFields";
import { OtpInput } from "../components/auth/OtpInput";
import {
  INITIAL_RESEND_COOLDOWN_SECONDS,
  OTP_LENGTH,
  OTP_VALIDITY_SECONDS,
  clearOtpIssuedAt,
  clearPendingEmail,
  formatCountdownMMSS,
  isValidOtpFormat,
  maskEmail,
  readOtpIssuedAt,
  readPendingEmail,
  remainingOtpSeconds,
  saveOtpIssuedAt,
} from "../lib/otpFlow";

/**
 * Step 5 OTP verification page (manual registration only).
 * Rendered inside the shared AuthLayout shell, so the card, illustration,
 * Google button, and responsive behavior match Login/Register exactly.
 * Holds no password and no tokens: only the pending email (location state
 * with a sessionStorage fallback) plus the in-memory OTP being typed.
 */
export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { status, user, verifyOtp, resendOtp } = useUser();

  const [email] = useState(() => {
    const fromState = (location.state as { email?: unknown } | null)?.email;
    if (typeof fromState === "string" && fromState) return fromState;
    return readPendingEmail();
  });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(INITIAL_RESEND_COOLDOWN_SECONDS);
  // Remaining lifetime of the current OTP (UX indicator only; the backend
  // enforces expiry). Reconstructed from the stored issuance timestamp so a
  // page refresh shows the true remainder instead of a full window.
  // Independent from the resend cooldown below.
  const [expiresIn, setExpiresIn] = useState(() => remainingOtpSeconds(readOtpIssuedAt()));

  useEffect(() => {
    if (cooldown <= 0 && expiresIn <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((remaining) => (remaining <= 1 ? 0 : remaining - 1));
      setExpiresIn((remaining) => (remaining <= 1 ? 0 : remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown, expiresIn]);

  if (status === "authed" && user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  if (!email) {
    return <Navigate to="/register" replace />;
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    // Disabled buttons don't stop every implicit (Enter-key) submit.
    if (busy) return;
    if (!isValidOtpFormat(otp)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    setError("");
    setAccountExists(false);
    setBusy(true);
    try {
      const authed = await verifyOtp(email, otp);
      clearPendingEmail();
      clearOtpIssuedAt();
      toast(`Welcome to Mero Note, ${authed.name}`);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.status === 409) setAccountExists(true);
        // NOTE: a verify 429 carries the dead OTP's remaining lifetime, NOT
        // a resend cooldown — it must never block the resend button, which
        // is the only recovery path after exhausted attempts. The resend
        // cooldown is driven solely by resend responses, enforced backend-side.
        if (typeof err.attemptsLeft === "number") {
          setError(
            err.attemptsLeft > 0
              ? `Incorrect verification code. ${err.attemptsLeft} ${err.attemptsLeft === 1 ? "attempt" : "attempts"} remaining.`
              : err.message,
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resending || busy || cooldown > 0) return;
    setError("");
    setResending(true);
    try {
      await resendOtp(email);
      // A new OTP was issued: the old code is dead, so clear it (verifying
      // it would only burn an attempt) and restart both timers.
      setOtp("");
      saveOtpIssuedAt();
      setExpiresIn(OTP_VALIDITY_SECONDS);
      setCooldown(INITIAL_RESEND_COOLDOWN_SECONDS);
      toast("A new verification code was sent to your email.");
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message);
        if (typeof err.retryAfterSeconds === "number") {
          setCooldown(err.retryAfterSeconds);
        }
      } else {
        setError("We couldn't send a new verification code. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Verify Your Email</h1>
        <p className="mt-1.5 text-sm font-medium text-muted-foreground">
          We sent a 6-digit verification code to{" "}
          <span className="font-semibold text-foreground" title={email} aria-label={`Verification code sent to ${email}`}>
            {maskEmail(email)}
          </span>
          .
        </p>
      </div>

      <form onSubmit={handleVerify} noValidate className="space-y-4">
        <OtpInput id="verify-otp" value={otp} onChange={setOtp} disabled={busy} />

        <p className={`text-center text-sm font-medium ${expiresIn > 0 ? "text-muted-foreground" : "text-error"}`}>
          {expiresIn > 0 ? `Code expires in ${formatCountdownMMSS(expiresIn)}` : "Code expired"}
        </p>

        <AuthFormError message={error} />

        <AuthSubmit busy={busy} busyLabel="Verifying..." disabled={busy || status === "loading" || otp.length !== OTP_LENGTH}>
          Verify Email
        </AuthSubmit>
      </form>

      <div className="mt-4 text-center text-sm font-medium text-muted-foreground">
        <p>Didn&apos;t receive the code?</p>
        {cooldown > 0 ? (
          // No live region: announcing every tick would spam screen readers.
          // The resend button appearing when the cooldown ends is the signal.
          <span className="mt-1 block">Resend in {formatCountdownMMSS(cooldown)}</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || busy}
            className="mt-1 font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? "Sending..." : "Resend code"}
          </button>
        )}
      </div>

      {accountExists && (
        <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </p>
      )}
      <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
        <Link to="/register" className="font-semibold text-primary hover:underline">
          ← Back to registration
        </Link>
      </p>
    </>
  );
}
