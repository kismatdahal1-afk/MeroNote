import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useToast } from "../state/ToastProvider";
import { useUser } from "../state/UserProvider";
import { AuthError } from "../lib/authApi";
import { savePendingEmail } from "../lib/otpFlow";
import { AuthField, AuthFormError, AuthSubmit, PasswordField } from "../components/auth/AuthFields";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status, user, initiateRegister } = useUser();

  if (status === "authed" && user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (trimmedName.length > 80) {
      setError("Name must be at most 80 characters.");
      return;
    }
    if (!email.trim() || !password || !confirmPassword) {
      setError("Please fill in name, email, password, and confirmation.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // Step 5: initiation sends the OTP and creates no account/session.
      // Only the email (non-sensitive routing context) leaves this page;
      // the password stays in component memory and is dropped on unmount.
      const normalizedEmail = email.trim();
      await initiateRegister(trimmedName, normalizedEmail, password, confirmPassword);
      savePendingEmail(normalizedEmail);
      toast("Verification code sent. Check your email.");
      navigate("/register/verify", { state: { email: normalizedEmail } });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Your Account</h1>
        <p className="mt-1.5 text-sm font-medium text-muted-foreground">
          Join Mero Note and organize your study resources.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField
          id="register-name"
          label="Full Name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />

        <AuthField
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <PasswordField
          id="register-password"
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
        />

        <PasswordField
          id="register-confirm"
          label="Confirm password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat your password"
          showPassword={showConfirmPassword}
          onTogglePassword={() => setShowConfirmPassword((v) => !v)}
        />

        <AuthFormError message={error} />

        <AuthSubmit busy={busy} busyLabel="Sending code..." disabled={busy || status === "loading"}>
          Create Account
        </AuthSubmit>
      </form>
    </>
  );
}
