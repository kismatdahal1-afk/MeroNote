import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ProductComposition } from "./ProductComposition";

/**
 * Hero: gradient headline → supporting copy → dual CTA →
 * dominant three-image product composition (REAL screenshots only).
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="landing-hero-heading"
      className="relative isolate w-full overflow-hidden pb-10 pt-4 text-left md:pb-6 md:pt-6 md:text-center"
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
          className="font-display animate-fade-up mx-0 max-w-[75%] text-4xl font-extrabold leading-[1.12] tracking-tight text-foreground motion-reduce:animate-none sm:text-6xl md:mx-auto md:max-w-4xl lg:text-7xl"
          style={{ animationDelay: "60ms" }}
        >
          Your entire
          <br className="md:hidden" /> CSIT journey,
          <br />
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            organized in one place.
          </span>
        </h1>
        <p
          className="animate-fade-up mx-0 mt-3 max-w-[75%] text-left text-lg font-normal leading-relaxed text-muted-foreground motion-reduce:animate-none sm:text-xl md:mx-auto md:max-w-2xl md:text-center"
          style={{ animationDelay: "140ms" }}
        >
          Keep your books, notes, questions, past papers and study resources
          organized in one personal CSIT library.
        </p>
        <div
          className="animate-fade-up mt-6 flex flex-row items-center justify-center gap-3 motion-reduce:animate-none sm:gap-4"
          style={{ animationDelay: "200ms" }}
        >
          <Link
            to="/register"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none sm:flex-none sm:w-auto sm:px-7 sm:text-base"
          >
            Get Started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to="/login?next=/dashboard"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-border-strong bg-surface px-4 text-sm font-bold text-foreground shadow-card transition-all hover:-translate-y-0.5 hover:bg-surface-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none sm:flex-none sm:w-auto sm:px-7 sm:text-base"
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
