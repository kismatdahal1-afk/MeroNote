import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NotebookPen, Loader2 } from "lucide-react";
import { useToast } from "../state/ToastProvider";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    setBusy(true);
    // Mock login â€” real authentication arrives in Phase 4.
    window.setTimeout(() => {
      setBusy(false);
      toast("Logged in (mock)");
      navigate("/dashboard");
    }, 600);
  };

  return (
    <div className="bg-hero-gradient flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <NotebookPen className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm font-medium text-muted-foreground">
            Log in to your Mero Note library
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
        >
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-semibold text-foreground">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-semibold text-foreground">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-border-strong text-primary focus:ring-primary/25"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => toast("Password reset is coming soon", "info")}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Logging in..." : "Log in"}
          </button>

          <p className="text-center text-sm font-medium text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => toast("Sign-up is not part of the demo yet", "info")}
              className="font-semibold text-primary hover:underline"
            >
              Sign up
            </button>
          </p>
        </form>

        <p className="mt-6 text-center text-xs font-medium text-muted-foreground/70">
          <Link to="/" className="hover:underline">
            â† Back to welcome page
          </Link>
          {" Â· "}Any credentials work in this demo (mock login)
        </p>
      </div>
    </div>
  );
}
