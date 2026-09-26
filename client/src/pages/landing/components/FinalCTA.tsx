import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

/* ---------- Final CTA — Your Study Space (standalone closing section) ---------- */

export function FinalCTA() {
  return (
    <section
      aria-labelledby="landing-cta-heading"
      className="mx-auto w-full max-w-2xl px-4 py-6 text-center sm:px-6 sm:py-8"
    >
      <Reveal>
        <div>
          <img
            src="/icon/icon.png"
            alt=""
            aria-hidden="true"
            width={112}
            height={112}
            loading="lazy"
            className="mx-auto size-28 rounded-[26px] object-cover shadow-card ring-1 ring-black/5"
          />

          <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.22em] text-primary">
            Your Study Space
          </p>
          <h2
            id="landing-cta-heading"
            className="font-display mx-auto mt-2 max-w-xl text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Your CSIT library starts here.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-muted-foreground">
            Organize your resources. Find what you need. Study your way.
          </p>
          <Link
            to="/register"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none"
          >
            Get Started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <p className="mt-4 text-[13px] font-medium text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
