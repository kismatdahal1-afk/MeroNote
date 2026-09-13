import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-muted text-primary ">
        <Compass className="size-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-8 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
