import { useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  FileArchive,
  FileText,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Layers,
  PenLine,
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
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-extrabold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2
        id={id}
        className="font-display mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
      >
        {title}
      </h2>
      <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}

/* ---------- Section 2 — Everything has a place ---------- */

const HIERARCHY = [
  { eyebrow: "Semester", title: "Semester 01" },
  { eyebrow: "Subject", title: "Computer Science" },
  { eyebrow: "Topic", title: "Programming" },
  { eyebrow: "Resource", title: "Short Notes" },
];

export function HierarchySection() {
  return (
    <section
      aria-labelledby="landing-place-heading"
      className="border-b border-border bg-surface py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="landing-place-heading"
            eyebrow="Organization"
            title="Everything has a place."
            copy="From semester to subject, topic to resource, Mero Note keeps your CSIT library structured so you can spend less time searching and more time studying."
          />
        </Reveal>
        <ol className="mx-auto mt-14 flex max-w-4xl flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0">
          {HIERARCHY.map(({ eyebrow, title }, i) => (
            <li key={title} className="flex flex-1 flex-col items-stretch md:flex-row md:items-center">
              <Reveal className="flex-1" delay={i * 100}>
                <div className="card-glow rounded-2xl border border-border bg-surface px-6 py-5 text-center shadow-card">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
                    {eyebrow}
                  </p>
                  <p className="font-display mt-1.5 text-lg font-extrabold tracking-tight text-foreground">
                    {title}
                  </p>
                </div>
              </Reveal>
              {i < HIERARCHY.length - 1 && (
                <span aria-hidden="true" className="flex justify-center py-1 md:px-3 md:py-0">
                  <ArrowDown className="size-5 text-primary md:hidden" />
                  <ArrowRight className="hidden size-5 shrink-0 text-primary md:block" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Section 3 — Resource type radial wheel (interactive navigation) ---------- */

const WHEEL_TYPES = [
  { icon: BookOpen, label: "Book", description: "Full-length study material for detailed subject learning." },
  { icon: FileText, label: "Short Notes", description: "Quick and focused notes for fast revision." },
  { icon: PenLine, label: "Handwritten Notes", description: "Personal-style handwritten material for easier understanding and review." },
  { icon: Layers, label: "Extra Notes", description: "Additional study material beyond the main resources." },
  { icon: HelpCircle, label: "Question", description: "Practice questions to test your understanding." },
  { icon: Sparkles, label: "Important Question", description: "Important questions to prioritize during preparation." },
  { icon: FileArchive, label: "Past Paper", description: "Previous exam papers for understanding exam patterns and practice." },
  { icon: FlaskConical, label: "Practical Lab", description: "Practical-focused resources for lab work and implementation." },
];

/** Base angle (deg) for each branch — evenly spaced, starting at top. */
const WHEEL_BASE_ANGLE = (i: number) => (270 + i * 45) % 360;

/**
 * Circular anchors: all 8 nodes sit on ONE circle (equal radius from the
 * hub), indexed to match the base angles N, NE, E, SE, S, SW, W, NW.
 * The orbit is set wide so every node floats well clear of the main circle.
 * Radius is proportional to wheel size, so spacing scales per breakpoint.
 */
const WHEEL_ORBIT_RADIUS = 44;
const WHEEL_BRANCH_END_RADIUS = 35;

const polarToPercent = (angleDeg: number, radius: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
};

/** Branch node anchors (percentages of the rotor box). */
const WHEEL_POSITIONS = Array.from({ length: 8 }, (_, i) => {
  const { x, y } = polarToPercent(WHEEL_BASE_ANGLE(i), WHEEL_ORBIT_RADIUS);
  return { left: `${x}%`, top: `${y}%` };
});

/** Branch endpoints — spokes stop under the node-circle edge. */
const WHEEL_SPOKES = Array.from({ length: 8 }, (_, i) => {
  const { x: x2, y: y2 } = polarToPercent(WHEEL_BASE_ANGLE(i), WHEEL_BRANCH_END_RADIUS);
  return { x2, y2 };
});

/** Fixed alignment point: east (0deg), facing the information card. */
const WHEEL_ACTIVE_ANGLE = 0;

/** Spin time scales with travel distance: near hops are snappy, far spins
 *  get more time but a higher angular speed — same smooth curve throughout. */
const SPIN_MS_FOR = (deltaDeg: number) => {
  const d = Math.abs(deltaDeg);
  return Math.round(Math.min(1000, Math.max(380, 320 + d * 2.8)));
};

export function UniverseSection() {
  // Single source of truth: selected branch + cumulative clockwise rotation.
  const [selected, setSelected] = useState(0);
  // Book (base 270°) starts aligned to the east alignment point (0°).
  const [rotation, setRotation] = useState(90);
  const [spinMs, setSpinMs] = useState(700);
  // Synchronous mirror of `rotation` so rapid successive clicks always
  // compute from the latest angle instead of a stale render closure.
  const rotationRef = useRef(90);
  const Active = WHEEL_TYPES[selected];

  const select = (i: number) => {
    if (i === selected) return;
    const current = (((WHEEL_BASE_ANGLE(i) + rotationRef.current) % 360) + 360) % 360;
    // Shortest path: clockwise when within 180°, otherwise anticlockwise
    // (negative delta). Exact 180° ties go clockwise.
    const clockwise = (((WHEEL_ACTIVE_ANGLE - current) % 360) + 360) % 360;
    const delta = clockwise <= 180 ? clockwise : clockwise - 360;
    rotationRef.current += delta;
    setSpinMs(SPIN_MS_FOR(delta));
    setRotation(rotationRef.current);
    setSelected(i);
  };

  return (
    <section
      aria-labelledby="landing-universe-heading"
      id="library"
      className="scroll-mt-24 border-y border-border bg-surface py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="landing-universe-heading"
            eyebrow="Resource Library"
            title="Everything you need in one library."
            copy="Keep every kind of CSIT study resource organized in one place, from books and notes to questions, practicals and past papers."
          />
        </Reveal>

        <div className="mt-12 lg:mt-14">
        {/* ------ CENTER: resource network ------ */}
        <Reveal className="flex flex-col items-center">
          <div
            className="relative aspect-square w-full max-w-[320px] sm:max-w-[440px] md:max-w-[500px] lg:max-w-[520px]"
            role="group"
            aria-label="Resource type wheel. Select a resource branch to rotate the wheel."
          >
            {/* fixed east alignment marker (never rotates) */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-8 sm:inset-10">
              <span className="absolute left-[94%] top-1/2 size-3.5 -translate-y-1/2 translate-x-[48px] rounded-full bg-primary ring-4 ring-primary/20" />
            </div>

            {/* rotating system: branches + nodes move as one */}
            <div
              className="absolute inset-8 transition-transform duration-[var(--spin-ms,700ms)] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none sm:inset-10"
              style={{ transform: `rotate(${rotation}deg)`, "--spin-ms": `${spinMs}ms` } as CSSProperties}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-0 h-full w-full text-primary"
              >
                {/* circular orbit ring through the 8 anchors — rotates with the network */}
                <circle
                  cx={50}
                  cy={50}
                  r={44}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.7}
                  opacity={0.4}
                  className="text-border-strong"
                />
                {WHEEL_SPOKES.map(({ x2, y2 }, i) => {
                  const active = i === selected;
                  const dx = x2 - 50;
                  const dy = y2 - 50;
                  const len = Math.hypot(dx, dy);
                  // tapered ray: wide at the hub, narrow at the node
                  const hw = active ? 3.4 : 2.8; // hub half-width
                  const nw = 0.9; // node half-width
                  const nx = -dy / len;
                  const ny = dx / len;
                  const pts = [
                    `${50 + nx * hw},${50 + ny * hw}`,
                    `${x2 + nx * nw},${y2 + ny * nw}`,
                    `${x2 - nx * nw},${y2 - ny * nw}`,
                    `${50 - nx * hw},${50 - ny * hw}`,
                  ].join(" ");
                  return (
                    <polygon
                      key={i}
                      points={pts}
                      fill="currentColor"
                      opacity={active ? 0.95 : 0.45}
                    />
                  );
                })}
              </svg>

              <ul className="absolute inset-0 list-none">
                {WHEEL_TYPES.map(({ icon: Icon, label }, i) => {
                  const active = i === selected;
                  return (
                    <li
                      key={label}
                      className="absolute"
                      style={{
                        left: WHEEL_POSITIONS[i].left,
                        top: WHEEL_POSITIONS[i].top,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      {/* counter-rotate so icon + name stay upright while the wheel spins */}
                      <div
                        className="transition-transform duration-[var(--spin-ms,700ms)] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
                        style={{ transform: `rotate(${-rotation}deg)`, "--spin-ms": `${spinMs}ms` } as CSSProperties}
                      >
                        <button
                          type="button"
                          onClick={() => select(i)}
                          aria-pressed={active}
                          aria-label={`Select ${label}`}
                          className={
                            active
                              ? "flex size-20 scale-110 flex-col items-center justify-center gap-1 rounded-full border-[3px] border-primary bg-primary p-2 text-center text-primary-foreground shadow-card-hover ring-4 ring-primary/20 transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transform-none sm:size-24"
                              : "flex size-20 flex-col items-center justify-center gap-1 rounded-full border-[3px] border-border-strong bg-surface p-2 text-center shadow-card transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transform-none sm:size-24"
                          }
                        >
                          <Icon
                            className={active ? "size-4 shrink-0 sm:size-5" : "size-4 shrink-0 text-primary sm:size-5"}
                            aria-hidden="true"
                          />
                          <span
                            className={
                              active
                                ? "text-[8px] font-extrabold leading-tight sm:text-[9px]"
                                : "text-[8px] font-bold leading-tight text-foreground sm:text-[9px]"
                            }
                          >
                            {label}
                          </span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* static center — never rotates */}
            <div className="absolute left-1/2 top-1/2 flex size-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-primary px-6 text-center text-primary-foreground shadow-card-hover ring-8 ring-primary-muted/60 sm:size-44">
              <p className="font-display text-lg font-extrabold leading-none tracking-tight sm:text-2xl">
                Resource
                <br />
                Library
              </p>
              <p className="mt-2 text-[10px] font-medium text-primary-foreground/85 sm:text-xs">
                Choose a resource type
              </p>
            </div>
          </div>
        </Reveal>

        {/* ------ selected resource caption + entry link ------ */}
        <div className="mt-8 flex flex-col items-center px-4 text-center">
          <p key={selected} className="animate-fade-up motion-reduce:animate-none">
            <span className="text-sm font-extrabold text-primary">{Active.label}</span>
            <span className="mt-1 block max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
              {Active.description}
            </span>
          </p>
          <Link
            to="/login?next=/resources"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none"
          >
            Explore Library
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <p aria-live="polite" className="sr-only">
            {Active.label}: {Active.description}
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}

/* ---------- Section 4 — Find it. Open it. Study. ---------- */

const WORKFLOW = [
  {
    n: "01",
    title: "Find",
    text: "Choose your semester, subject or topic and quickly discover what you need.",
  },
  {
    n: "02",
    title: "Open",
    text: "Open the resource directly without digging through folders or scattered files.",
  },
  {
    n: "03",
    title: "Study",
    text: "Read, bookmark and continue your study from where you left off.",
  },
];

export function WorkflowSection() {
  return (
    <section
      aria-labelledby="landing-workflow-heading"
      className="border-y border-border bg-surface-muted/50 py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="landing-workflow-heading"
            eyebrow="Workflow"
            title="Find it. Open it. Study."
            copy="Mero Note keeps the journey from searching for a resource to actually studying it simple."
          />
        </Reveal>
        <ol className="relative mx-auto mt-14 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-6">
          <span
            aria-hidden="true"
            className="absolute left-[16%] right-[16%] top-5 hidden h-px bg-border-strong md:block"
          />
          {WORKFLOW.map(({ n, title, text }, i) => (
            <Reveal as="li" key={n} delay={i * 110}>
              <div className="relative text-center md:text-left">
                <span
                  aria-hidden="true"
                  className="font-display relative z-10 mx-auto flex size-10 items-center justify-center rounded-full border border-border-strong bg-surface text-sm font-extrabold text-primary shadow-card md:mx-0"
                >
                  {n}
                </span>
                <h3 className="font-display mt-4 text-xl font-extrabold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground md:mx-0">
                  {text}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Section 5 — Reading experience (real functionality only) ---------- */

const READING_ROWS = [
  {
    n: "01",
    title: "Reading",
    text: "A focused, distraction-free reader for every resource in your library.",
  },
  {
    n: "02",
    title: "Bookmarks",
    text: "Mark exact pages with notes and jump straight back to them.",
  },
  {
    n: "03",
    title: "Progress",
    text: "Your reading progress is saved to your account automatically.",
  },
  {
    n: "04",
    title: "Recent resources",
    text: "Recently opened files are always one tap away.",
  },
  {
    n: "05",
    title: "Continue studying",
    text: "Keep an explicit Continue Reading list and resume anytime.",
  },
];

export function ReadingSection() {
  return (
    <section
      aria-labelledby="landing-reading-heading"
      className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
                Study Experience
              </p>
              <h2
                id="landing-reading-heading"
                className="font-display mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
              >
                From finding a resource to actually studying it.
              </h2>
              <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground">
                Once you find what you need, Mero Note keeps the reading
                experience focused and organized.
              </p>
              <Link
                to="/register"
                className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none"
              >
                Get Started
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
        <ol className="lg:col-span-7">
          {READING_ROWS.map(({ n, title, text }, i) => (
            <Reveal as="li" key={n} delay={i * 70}>
              <div className="flex items-baseline gap-5 border-t border-border py-6 last:border-b">
                <span aria-hidden="true" className="font-display text-sm font-extrabold text-primary/60">
                  {n}
                </span>
                <div>
                  <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Section 6 — Mobile experience ---------- */

export function MobileSection() {
  return (
    <section
      aria-labelledby="landing-mobile-heading"
      className="border-y border-border bg-surface-muted/50 py-20 lg:py-24"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Reveal>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
              Mobile Experience
            </p>
            <h2
              id="landing-mobile-heading"
              className="font-display mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
            >
              Your library, wherever you study.
            </h2>
            <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground">
              Start on your desktop. Continue from your phone. Keep your study
              resources close wherever you are.
            </p>
            <ul className="mt-7 space-y-3.5">
              {[
                ["Same account everywhere", "One library across desktop and phone."],
                ["Readable on small screens", "The full library, fitted for mobile browsers."],
                ["Study without internet", "Downloaded files stay available offline."],
              ].map(([title, text]) => (
                <li key={title} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-muted text-xs font-bold text-success"
                  >
                    ✓
                  </span>
                  <p className="text-sm font-medium text-muted-foreground">
                    <span className="font-bold text-foreground">{title}. </span>
                    {text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <figure className="mx-auto w-48 sm:w-56">
            <div className="overflow-hidden rounded-[1.75rem] border border-border-strong bg-surface shadow-card-hover ring-1 ring-black/5">
              <img
                src="/images/phone.png"
                alt="Mero Note mobile resource library"
                width={904}
                height={1740}
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

/* ---------- Section 7 — Built around the way you study (asymmetric) ---------- */

const PILLARS = [
  {
    n: "01",
    title: "Organized",
    text: "Your CSIT resources stay structured by semester, subject and topic.",
    span: true,
  },
  {
    n: "02",
    title: "Discoverable",
    text: "Find the material you need without searching through scattered folders.",
    span: false,
  },
  {
    n: "03",
    title: "Personal",
    text: "Keep important resources close with favorites and bookmarks where supported.",
    span: false,
  },
  {
    n: "04",
    title: "Continuous",
    text: "Return to your study resources and continue from where you left off where supported.",
    span: true,
  },
];

export function PillarsSection() {
  return (
    <section
      aria-labelledby="landing-pillars-heading"
      id="features"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
    >
      <Reveal>
        <SectionHeading
          id="landing-pillars-heading"
          eyebrow="Study Tools"
          title="Built around the way you study."
          copy="Mero Note is designed to keep your academic resources organized without getting in the way of your study."
        />
      </Reveal>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {PILLARS.map(({ n, title, text, span }, i) => (
          <Reveal
            key={n}
            delay={(i % 2) * 90}
            className={span ? "md:col-span-2" : ""}
          >
            <div
              className={
                span
                  ? "flex h-full flex-col justify-between gap-6 rounded-3xl bg-primary p-8 text-primary-foreground shadow-card-hover transition-transform hover:-translate-y-1 motion-reduce:transform-none sm:flex-row sm:items-center lg:p-10"
                  : "card-glow h-full rounded-3xl border border-border bg-surface p-8 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transform-none"
              }
            >
              <div>
                <p
                  aria-hidden="true"
                  className={
                    span
                      ? "font-display text-sm font-extrabold tracking-widest text-primary-foreground/70"
                      : "font-display text-sm font-extrabold tracking-widest text-primary/60"
                  }
                >
                  {n}
                </p>
                <h3
                  className={
                    span
                      ? "font-display mt-2 text-2xl font-extrabold tracking-tight text-primary-foreground sm:text-3xl"
                      : "font-display mt-2 text-2xl font-extrabold tracking-tight text-foreground"
                  }
                >
                  {title}
                </h3>
                <p
                  className={
                    span
                      ? "mt-2 max-w-md text-sm font-medium leading-relaxed text-primary-foreground/85"
                      : "mt-2 text-sm font-medium leading-relaxed text-muted-foreground"
                  }
                >
                  {text}
                </p>
              </div>
              {span && (
                <GraduationCap
                  aria-hidden="true"
                  className="hidden size-16 shrink-0 text-primary-foreground/25 sm:block"
                />
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- Section 8 — Your study journey (calm vertical timeline) ---------- */

const JOURNEY = [
  { n: "01", title: "Choose your semester", text: "Start where you are in the curriculum." },
  { n: "02", title: "Select your subject", text: "Open the subject you need today." },
  { n: "03", title: "Explore your resources", text: "Browse books, notes, questions and papers." },
  { n: "04", title: "Open what you need", text: "Read directly — no folder digging." },
  { n: "05", title: "Continue your study", text: "Bookmark, track progress, resume anytime." },
];

export function JourneySection() {
  return (
    <section
      aria-labelledby="landing-journey-heading"
      id="how-it-works"
      className="scroll-mt-24 border-t border-border bg-surface-muted/50 py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="landing-journey-heading"
            eyebrow="Study Journey"
            title="From semester to study session."
            copy="A calm path through your library, every time you sit down to study."
          />
        </Reveal>
        <ol className="relative mt-14 space-y-2 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-border-strong">
          {JOURNEY.map(({ n, title, text }, i) => (
            <Reveal as="li" key={n} delay={i * 80}>
              <div className="relative flex gap-5 py-4 pl-1">
                <span
                  aria-hidden="true"
                  className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-xs font-extrabold text-primary shadow-card"
                >
                  {n}
                </span>
                <div className="pt-1">
                  <h3 className="text-base font-bold text-foreground">{title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Section 9 — Final CTA ---------- */

export function FinalCTA() {
  return (
    <section aria-labelledby="landing-cta-heading" className="mx-auto w-full max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-24">
      <Reveal>
        <div>
          <img
            src="/icon/icon.png"
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
            loading="lazy"
            className="mx-auto size-16 rounded-2xl object-cover shadow-card"
          />
          <h2
            id="landing-cta-heading"
            className="font-display mx-auto mt-6 max-w-xl text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl"
          >
            Your CSIT library starts here.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-muted-foreground">
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

/* ---------- Footer ---------- */

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
    <footer className="border-t border-border bg-surface py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 sm:px-6 md:flex-row md:justify-between">
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
            <p className="text-sm font-extrabold text-foreground">Mero Note</p>
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
        <p className="text-xs font-medium text-muted-foreground">
          © 2026 Mero Note. Designed for CSIT students.
        </p>
      </div>
    </footer>
  );
}
