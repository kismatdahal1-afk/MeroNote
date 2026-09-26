import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "../state/ToastProvider";
import { useUser } from "../state/UserProvider";
import { AuthError } from "../lib/authApi";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status, user, register } = useUser();

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
      const authed = await register(trimmedName, email.trim(), password, confirmPassword);
      toast(`Welcome to Mero Note, ${authed.name}`);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/icon/icon.png"
            alt="Mero Note"
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-2xl object-cover shadow-md"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm font-medium text-muted-foreground">
            Join your Mero Note study library
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="card-glow space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
        >
          <div className="space-y-1.5">
            <label htmlFor="register-name" className="block text-sm font-semibold text-foreground">
              Name
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-email" className="block text-sm font-semibold text-foreground">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-password" className="block text-sm font-semibold text-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 pr-11 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                {showPassword ? <EyeOff className="size-4.5" aria-hidden="true" /> : <Eye className="size-4.5" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="register-confirm" className="block text-sm font-semibold text-foreground">
              Confirm password
            </label>
            <input
              id="register-confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || status === "loading"}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Creating account..." : "Sign up"}
          </button>

          <p className="text-center text-sm font-medium text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs font-medium text-muted-foreground/70">
          <Link to="/" className="hover:underline">
            ← Back to welcome page
          </Link>
        </p>
      </div>
    </div>
  );
}
