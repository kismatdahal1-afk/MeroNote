import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap } from "lucide-react";
import { ProductComposition } from "./ProductComposition";

/**
 * Hero: eyebrow → headline → supporting copy → dual CTA →
 * dominant three-image product composition.
 */
export function HeroSection() {
  return (
    <section aria-labelledby="landing-hero-heading" className="mx-auto w-full max-w-6xl px-4 pt-12 text-center sm:px-6 lg:pt-16">
      <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-xs font-semibold text-primary motion-reduce:animate-none">
        <GraduationCap className="size-3.5" aria-hidden="true" />
        CSIT Study Library
      </p>
      <h1
        id="landing-hero-heading"
        className="font-display animate-fade-up mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-foreground motion-reduce:animate-none sm:text-5xl lg:text-6xl"
        style={{ animationDelay: "60ms" }}
      >
        Your entire CSIT journey,
        <br />
        <span className="text-primary">organized in one place.</span>
      </h1>
      <p
        className="animate-fade-up mx-auto mt-5 max-w-xl text-base font-medium leading-relaxed text-muted-foreground motion-reduce:animate-none sm:text-lg"
        style={{ animationDelay: "140ms" }}
      >
        Keep your books, notes, questions, past papers and study resources
        organized in one personal CSIT library.
      </p>
      <div
        className="animate-fade-up mt-8 flex flex-col items-center justify-center gap-3 motion-reduce:animate-none sm:flex-row"
        style={{ animationDelay: "200ms" }}
      >
        <Link
          to="/register"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none sm:w-auto"
        >
          Get Started
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          to="/login?next=/dashboard"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-surface px-7 text-base font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:bg-surface-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none sm:w-auto"
        >
          Explore Library
        </Link>
      </div>

      <div className="mt-12 lg:mt-16">
        <ProductComposition />
      </div>
    </section>
  );
}
