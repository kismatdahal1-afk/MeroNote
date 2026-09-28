import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "../../state/ThemeProvider";
import { LandingFooter } from "../landing/components/Sections";

export interface LegalSectionData {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  note?: string;
}

interface LegalPageLayoutProps {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSectionData[];
  children?: ReactNode;
}

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function LegalHeader() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Mero Note home"
          className={`flex min-w-0 items-center gap-2.5 rounded-lg ${FOCUS_RING}`}
        >
          <img
            src="/icon/icon.png"
            alt="Mero Note"
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-cover"
          />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
              Mero Note
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              CSIT Study Library
            </span>
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-2">
          <Link
            to="/"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground ${FOCUS_RING}`}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={`flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground ${FOCUS_RING}`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4.5" aria-hidden="true" />
            ) : (
              <Moon className="size-4.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export function LegalSection({
  index,
  section,
}: {
  index: number;
  section: LegalSectionData;
}) {
  return (
    <section aria-labelledby={`legal-section-${index + 1}`}>
      <h2
        id={`legal-section-${index + 1}`}
        className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
      >
        <span className="mr-2 font-mono text-sm font-bold text-primary">
          {index + 1}.
        </span>
        {section.heading}
      </h2>
      <div className="mt-3 space-y-3">
        {section.paragraphs.map((paragraph) => (
          <p
            key={paragraph.slice(0, 48)}
            className="text-[15px] leading-7 text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
      </div>
      {section.bullets && section.bullets.length > 0 && (
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          {section.bullets.map((bullet) => (
            <li
              key={bullet.slice(0, 48)}
              className="text-[15px] leading-7 text-muted-foreground"
            >
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {section.note && (
        <p className="mt-3 border-l-2 border-primary/40 pl-4 text-sm leading-7 text-muted-foreground">
          {section.note}
        </p>
      )}
    </section>
  );
}

/**
 * Shared legal/document shell: minimal header, single subtle watermark,
 * readable document body, existing footer. Content pages supply only
 * title/intro/sections.
 */
export function LegalPageLayout({
  title,
  intro,
  updated,
  sections,
  children,
}: LegalPageLayoutProps) {
  useEffect(() => {
    document.title = `${title} — Mero Note`;
  }, [title]);

  return (
    <div className="bg-hero-gradient flex min-h-screen flex-col">
      <LegalHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <article className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-10">
            {/* Single decorative watermark — excluded from accessibility tree. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <img
                src="/icon/icon.png"
                alt=""
                draggable={false}
                loading="lazy"
                className="absolute left-1/2 top-10 size-64 -translate-x-1/2 select-none rounded-3xl object-cover opacity-[0.05] dark:opacity-[0.07] sm:size-80"
              />
            </div>
            <div className="relative z-10">
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
                Mero Note · Legal
              </p>
              <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                Last Updated: {updated}
              </p>
              <p className="mt-4 text-[15px] font-medium leading-7 text-muted-foreground">
                {intro}
              </p>
              <div aria-hidden="true" className="my-8 h-px w-full bg-border" />
              <div className="space-y-9">
                {sections.map((section, i) => (
                  <LegalSection key={section.heading} index={i} section={section} />
                ))}
              </div>
              {children}
            </div>
          </article>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
