import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ProductComposition } from "./ProductComposition";

/**
 * Hero: eyebrow → gradient headline → supporting copy → dual CTA →
 * dominant three-image product composition (REAL screenshots only).
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="landing-hero-heading"
      className="relative isolate w-full overflow-hidden pt-4 text-center md:pt-6"
    >
      {/* Soft ambient glow behind the headline (single layer, subtle). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[22rem] w-[42rem] max-w-none -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      {/* Thin line grid — full hero width, behind all content. */}
      <div aria-hidden="true" className="landing-hero-grid" />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1
          id="landing-hero-heading"
          className="font-display animate-fade-up mx-auto max-w-4xl text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground motion-reduce:animate-none sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "60ms" }}
        >
          Your entire CSIT journey,
          <br className="hidden sm:inline" />{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            organized in one place.
          </span>
        </h1>
        <p
          className="animate-fade-up mx-auto mt-3 max-w-2xl text-lg font-normal leading-relaxed text-muted-foreground motion-reduce:animate-none sm:text-xl"
          style={{ animationDelay: "140ms" }}
        >
          Keep your books, notes, questions, past papers and study resources
          organized in one personal CSIT library.
        </p>
        <div
          className="animate-fade-up mt-6 flex flex-col items-center justify-center gap-4 motion-reduce:animate-none sm:flex-row"
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
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-border-strong bg-surface px-7 text-base font-bold text-foreground shadow-card transition-all hover:-translate-y-0.5 hover:bg-surface-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none sm:w-auto"
          >
            Explore Library
          </Link>
        </div>

        <div className="mt-6 lg:mt-8">
          <ProductComposition />
        </div>
      </div>
    </section>
  );
}
