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
    // Mock login — real authentication arrives in Phase 4.
    window.setTimeout(() => {
      setBusy(false);
      toast("Logged in (mock)");
      navigate("/dashboard");
    }, 600);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
            <NotebookPen className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Log in to your Mero Note library
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900"
        >
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => toast("Password reset is coming soon", "info")}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Logging in..." : "Log in"}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => toast("Sign-up is not part of the demo yet", "info")}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Sign up
            </button>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link to="/" className="hover:underline">
            ← Back to welcome page
          </Link>
          {" · "}Any credentials work in this demo (mock login)
        </p>
      </div>
    </div>
  );
}
