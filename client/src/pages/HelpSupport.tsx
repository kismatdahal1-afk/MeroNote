import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

export default function HelpSupport() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-muted text-primary">
        <LifeBuoy className="size-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
        Help &amp; Support
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This section is under construction and will arrive in an upcoming
        release. Meanwhile, browse the library or revisit your study shelf.
      </p>
      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
        <Link
          to="/resources"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Browse resources
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border-strong bg-surface px-5 text-sm font-bold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
