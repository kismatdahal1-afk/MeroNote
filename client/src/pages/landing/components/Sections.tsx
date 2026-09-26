import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  ClipboardList,
  FileArchive,
  FileStack,
  FileText,
  FlaskConical,
  GraduationCap,
  HardDriveDownload,
  HelpCircle,
  Layers,
  Search,
  Sparkles,
} from "lucide-react";
import { Reveal } from "./Reveal";

/* ---------- shared section heading ---------- */

function SectionHeading({
  eyebrow,
  title,
  copy,
  id,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  /** Heading id targeted by the section's aria-labelledby. */
  id: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h2
        id={id}
        className="font-display mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
      >
        {title}
      </h2>
      <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
        {copy}
      </p>
    </div>
  );
}

/* ---------- Semester → Subject → Topic → Resource ---------- */

const HIERARCHY = [
  {
    step: "01",
    icon: GraduationCap,
    title: "Semester",
    text: "Eight semesters, laid out exactly like your CSIT curriculum.",
  },
  {
    step: "02",
    icon: BookOpen,
    title: "Subject",
    text: "Every subject in its semester — theory, elective and practical.",
  },
  {
    step: "03",
    icon: Layers,
    title: "Topic",
    text: "Syllabus topics with hot topics surfaced for exam focus.",
  },
  {
    step: "04",
    icon: FileStack,
    title: "Resource",
    text: "Books, notes and papers attached right where you need them.",
  },
];

export function OrgHierarchy() {
  return (
    <section aria-labelledby="landing-org-heading" className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 lg:pt-28">
      <Reveal>
        <SectionHeading
          id="landing-org-heading"
          eyebrow="Organization"
          title="Everything has a place."
          copy="Mero Note follows your degree structure, so you always know where a file lives — and where to find it again."
        />
      </Reveal>
      <ol className="relative mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HIERARCHY.map(({ step, icon: Icon, title, text }, i) => (
          <Reveal as="li" key={title} delay={i * 90}>
            <div className="card-glow group relative h-full rounded-2xl border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transform-none">
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary-muted text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <span aria-hidden="true" className="font-display text-sm font-bold text-muted-foreground/50">
                  {step}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </Reveal>
        ))}
      </ol>
      {/* Secondary showcase: the real semester view, supporting the hierarchy above. */}
      <Reveal delay={120}>
        <figure className="mx-auto mt-10 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-card-hover ring-1 ring-black/5">
            <img
              src="/images/Semester.png"
              alt="Mero Note semester and subject library"
              width={1280}
              height={800}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full object-contain"
            />
          </div>
          <figcaption className="mt-3 text-center text-xs font-medium text-muted-foreground">
            Semester library — subjects, topics and resources in one place
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}

/* ---------- Resource library (real categories only) ---------- */

const RESOURCE_CATEGORIES = [
  { icon: BookOpen, label: "Books", text: "Prescribed textbooks, linked to their subjects." },
  { icon: FileText, label: "Short Notes", text: "Condensed notes for fast revision." },
  { icon: Layers, label: "Extra Notes", text: "Handwritten and extra material beyond class." },
  { icon: HelpCircle, label: "Questions", text: "Practice questions organized by topic." },
  { icon: FileArchive, label: "Past Papers", text: "Previous board papers with year and marks." },
  { icon: Sparkles, label: "Important Questions", text: "High-probability questions, exam-ready." },
  { icon: FlaskConical, label: "Practical / Lab", text: "Lab work and practical files in one place." },
  { icon: ClipboardList, label: "Revision Notes", text: "Final-pass summaries before the exam." },
];

export function ResourceLibrary() {
  return (
    <section aria-labelledby="landing-library-heading" id="library" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 lg:pt-28">
      <Reveal>
        <SectionHeading
          id="landing-library-heading"
          eyebrow="Resource library"
          title="One library, every kind of material."
          copy="Search across titles, subjects, semesters and types — then open anything in the built-in reader."
        />
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {RESOURCE_CATEGORIES.map(({ icon: Icon, label, text }, i) => (
          <Reveal key={label} delay={(i % 4) * 80}>
            <div
              role="listitem"
              className="h-full rounded-2xl border border-border bg-surface p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transform-none"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-3.5 text-sm font-bold text-foreground">{label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Mobile experience (reuses the real iPhone shot) ---------- */

export function MobileShowcase() {
  return (
    <section
      aria-labelledby="landing-mobile-heading"
      className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 lg:pt-28"
    >
      <div className="card-glow grid items-center gap-10 overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-card sm:p-12 lg:grid-cols-2">
        <Reveal>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Mobile experience
            </p>
            <h2
              id="landing-mobile-heading"
              className="font-display mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              Your study library, wherever you study.
            </h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
              Study at your desk. Continue from your phone. The same semesters,
              subjects and resources — responsive on mobile browsers and
              installable as an app for offline-ready study.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Same library on desktop and phone",
                "Readable on small screens, no separate app to learn",
                "Downloads keep files available without internet",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-foreground">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-muted text-xs font-bold text-success"
                  >
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none"
            >
              Get Started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <figure className="mx-auto w-44 sm:w-52">
            <div className="overflow-hidden rounded-[1.75rem] border border-border-strong bg-surface-muted shadow-card-hover ring-1 ring-black/5">
              <img
                src="/images/Resource_iPhone.png"
                alt="Mero Note mobile resource library"
                width={420}
                height={880}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full object-contain"
              />
            </div>
            <figcaption className="mt-3 text-center text-xs font-medium text-muted-foreground">
              Mero Note on mobile
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */

const STEPS = [
  { n: "01", title: "Choose your semester", text: "Pick from all eight CSIT semesters." },
  { n: "02", title: "Find your subject", text: "Browse the subject list with search." },
  { n: "03", title: "Open your resource", text: "Read books, notes and papers instantly." },
  { n: "04", title: "Study and continue", text: "Bookmark, track progress, pick up later." },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="landing-how-heading"
      id="how-it-works"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 lg:pt-28"
    >
      <Reveal>
        <SectionHeading
          id="landing-how-heading"
          eyebrow="How it works"
          title="Studying, minus the hunting."
          copy="Four steps between you and the file you need."
        />
      </Reveal>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ n, title, text }, i) => (
          <Reveal as="li" key={n} delay={i * 90}>
            <div className="relative h-full rounded-2xl border border-border bg-surface p-6 shadow-card">
              <span aria-hidden="true" className="font-display text-3xl font-bold text-primary/25">
                {n}
              </span>
              <h3 className="mt-3 text-base font-bold text-foreground">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ---------- Real capabilities only ---------- */

const FEATURES = [
  {
    icon: GraduationCap,
    title: "Organized semesters",
    text: "The full CSIT curriculum, semester by semester.",
  },
  {
    icon: BookOpen,
    title: "Subject navigation",
    text: "Topics and hot topics inside every subject.",
  },
  {
    icon: Search,
    title: "Fast search",
    text: "Find anything by title, subject, type or tag.",
  },
  {
    icon: Bookmark,
    title: "Favorites & bookmarks",
    text: "Save resources and mark exact pages.",
  },
  {
    icon: FileStack,
    title: "Reading progress",
    text: "Continue reading and recent views pick up where you left off.",
  },
  {
    icon: HardDriveDownload,
    title: "Downloads & offline",
    text: "Keep PDFs on-device for study without internet.",
  },
];

export function FeatureGrid() {
  return (
    <section
      aria-labelledby="landing-features-heading"
      id="features"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6 lg:pt-28"
    >
      <Reveal>
        <SectionHeading
          id="landing-features-heading"
          eyebrow="Features"
          title="Built for how CSIT students actually study."
          copy="Personal-first tools around a calm, organized library."
        />
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <Reveal key={title} delay={(i % 3) * 80}>
            <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transform-none">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-3.5 text-sm font-bold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */

export function FinalCTA() {
  return (
    <section aria-labelledby="landing-cta-heading" className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6 lg:pt-28">
      <Reveal>
        <div className="bg-hero-gradient rounded-3xl border border-border px-6 py-14 text-center shadow-card sm:px-12">
          <h2
            id="landing-cta-heading"
            className="font-display mx-auto max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Your CSIT library starts here.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
            Organize your resources. Find what you need. Study your way.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none"
          >
            Get Started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
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

/* ---------- Minimal footer ---------- */

interface FooterLink {
  label: string;
  /** In-page anchor for section links. */
  href?: string;
  /** Router path for app links. Set when `href` is absent. */
  to?: string;
}

const FOOTER_LINKS: FooterLink[] = [
  { label: "Library", href: "#library" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Login", to: "/login" },
  { label: "Get Started", to: "/register" },
];

export function LandingFooter() {
  return (
    <footer className="mt-20 border-t border-border lg:mt-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon/icon.png"
            alt="Mero Note"
            width={32}
            height={32}
            loading="lazy"
            className="size-8 shrink-0 rounded-lg object-cover"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">Mero Note</p>
            <p className="text-xs font-medium text-muted-foreground">CSIT Study Library</p>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
