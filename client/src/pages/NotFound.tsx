import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300">
        <Compass className="size-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-8 inline-flex h-10 items-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
