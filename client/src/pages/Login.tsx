import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "../state/ToastProvider";
import { useUser } from "../state/UserProvider";
import { AuthError } from "../lib/authApi";
import { AuthField, AuthFormError, AuthSubmit, PasswordField } from "../components/auth/AuthFields";

function homeForRole(role: "USER" | "ADMIN"): string {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, user, login } = useUser();

  if (status === "authed" && user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const authed = await login(email.trim(), password, remember);
      toast(`Welcome back, ${authed.name}`);
      const next = searchParams.get("next");
      navigate(next && next.startsWith("/") ? next : homeForRole(authed.role));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome Back</h1>
        <p className="mt-1.5 text-sm font-medium text-muted-foreground">
          Login to continue to your Mero Note account.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((v) => !v)}
        />

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

        <AuthFormError message={error} />

        <AuthSubmit busy={busy} busyLabel="Logging in..." disabled={busy || status === "loading"}>
          Login
        </AuthSubmit>
      </form>
    </>
  );
}
