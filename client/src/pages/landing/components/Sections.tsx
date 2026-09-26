import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  Clock,
  FileArchive,
  FileText,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Layers,
  Library,
  PenLine,
  Play,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";
import { ALL_RESOURCE_TYPES } from "../../../lib/resourceType";
import { useUser } from "../../../state/UserProvider";
import {
  INSTAGRAM_URL,
  LANDING_SECTION_IDS,
  STUDY_DESTINATIONS,
  loginWithNext,
  scrollToLandingSection,
} from "../../../lib/site";

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

/* ---------- Section 2 — Everything has a place (timeline) ---------- */

interface HierarchyStep {
  step: string;
  eyebrow: string;
  title: string;
  text: string;
  icon: LucideIcon;
  meta: string[];
}

const HIERARCHY: HierarchyStep[] = [
  {
    step: "01",
    eyebrow: "Semester",
    title: "Semester 01",
    text: "Start with your semester and keep your entire study library organized.",
    icon: GraduationCap,
    meta: ["Sem 1 – Sem 8", "BSc CSIT"],
  },
  {
    step: "02",
    eyebrow: "Subject",
    title: "Computer Science",
    text: "Find everything related to a specific subject in one place.",
    icon: BookOpen,
    meta: ["CSC101 · CSC102", "Core & electives"],
  },
  {
    step: "03",
    eyebrow: "Topic",
    title: "Programming",
    text: "Go deeper into individual topics without losing your place.",
    icon: Layers,
    meta: ["Pointers · K-maps", "Hot topics"],
  },
  {
    step: "04",
    eyebrow: "Resource",
    title: "Short Notes",
    text: "Access the exact material you need to study, revise, or practice.",
    icon: FileText,
    meta: [`${ALL_RESOURCE_TYPES.length} types`, "Books · Past Papers"],
  },
];

/* Desktop rail: three gap segments running edge-to-edge between
   consecutive node circumferences — the line never enters any circle
   interior. Offsets derive from the 4-col grid math (equal columns,
   20px gaps, centered 44px nodes). */
const RAIL_SEGMENTS = [
  "md:left-[calc(12.5%_+_14.5px)] md:right-[calc(62.5%_+_24.5px)]",
  "md:left-[calc(37.5%_+_19.5px)] md:right-[calc(37.5%_+_19.5px)]",
  "md:left-[calc(62.5%_+_24.5px)] md:right-[calc(12.5%_+_14.5px)]",
];

const NODE_CHIP_TONES = {
  highlight: "border-primary/30 bg-primary-muted text-primary",
  muted: "border-border bg-surface-muted text-muted-foreground",
} as const;

function TimelineStep({
  item,
  isLast,
  index,
}: {
  item: HierarchyStep;
  isLast: boolean;
  index: number;
}) {
  const { step, eyebrow, title, text, icon: Icon, meta } = item;
  const chipTone = isLast ? NODE_CHIP_TONES.highlight : NODE_CHIP_TONES.muted;
  return (
    <Reveal as="li" key={title} delay={index * 120} className="group relative">
      {/* Mobile rail segment: node bottom edge to next node */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute -bottom-8 left-[22px] top-[44px] w-[3px] -translate-x-1/2 bg-primary dark:bg-white md:hidden"
        />
      )}
      <div className="flex items-start gap-4 text-left md:flex-col md:items-center md:text-center">
        {/* Stroke-only circular node — transparent fill. Same icon zoom
            as the Study Experience timeline: the icon alone scales on
            hover, circle and rails untouched. */}
        <span
          aria-hidden="true"
          className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-primary bg-transparent text-primary shadow-card transition-transform dark:border-white"
        >
          <Icon
            className="size-4 transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover:scale-125"
            aria-hidden="true"
          />
        </span>
        <div className="pt-0.5 md:pt-0">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary">
            {step} — {eyebrow}
          </p>
          <p className="font-display mt-1 text-base font-extrabold tracking-tight text-foreground md:mt-3">
            {title}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {text}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 md:justify-center" aria-label={`${title} highlights`}>
            {meta.map((chip) => (
              <span
                key={chip}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chipTone}`}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function HierarchySection() {
  return (
    <section
      aria-labelledby="landing-place-heading"
      className="border-b border-border bg-surface py-12 lg:py-16"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="landing-place-heading"
            eyebrow="Organization"
            title="Everything has a place."
            copy="Semester → Subject → Topic → Resource — connected, organized, easy to find."
          />
        </Reveal>
        <Reveal delay={120}>
          <ol className="relative mx-auto mt-10 grid max-w-5xl gap-8 md:grid-cols-4 md:gap-5">
            {RAIL_SEGMENTS.map((pos) => (
              <span
                key={pos}
                aria-hidden="true"
                className={`absolute top-[22px] hidden h-[3px] bg-primary dark:bg-white md:block md:w-auto md:-translate-y-1/2 ${pos}`}
              />
            ))}
            {HIERARCHY.map((item, i) => (
              <TimelineStep
                key={item.title}
                item={item}
                index={i}
                isLast={i === HIERARCHY.length - 1}
              />
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Section 3 — Resource type radial wheel (interactive navigation) ---------- */

const WHEEL_TYPES = [
  {
    icon: BookOpen,
    label: "Book",
    description: "Complete, chapter-wise study material that builds deep conceptual clarity for every subject.",
    points: ["Chapter-wise complete coverage", "Concept-first explanations", "Ideal for first-time learning"],
  },
  {
    icon: FileText,
    label: "Short Notes",
    description: "Crisp, exam-focused notes that compress each chapter into minutes of fast revision.",
    points: ["One-page chapter summaries", "Key formulas and definitions", "Perfect for last-day revision"],
  },
  {
    icon: PenLine,
    label: "Handwritten Notes",
    description: "Neat, personal-style handwritten material that makes tough topics easier to grasp and recall.",
    points: ["Simple student-friendly writing", "Easy diagrams and memory tricks", "Built for quicker recall"],
  },
  {
    icon: Layers,
    label: "Extra Notes",
    description: "Curated supplementary material that goes beyond the syllabus for stronger preparation.",
    points: ["Beyond-the-syllabus insights", "Reference-style deep dives", "Made for deeper mastery"],
  },
  {
    icon: HelpCircle,
    label: "Question",
    description: "Topic-wise practice questions designed to test understanding and sharpen problem-solving.",
    points: ["Topic-wise practice sets", "Mixed difficulty levels", "Ready for self-testing"],
  },
  {
    icon: Sparkles,
    label: "Important Question",
    description: "High-probability questions prioritized so revision time goes exactly where it matters most.",
    points: ["Exam-focused shortlist", "Priority-marked topics", "Revise what matters first"],
  },
  {
    icon: FileArchive,
    label: "Past Paper",
    description: "Previous exam papers that reveal question patterns, marking trends, and real exam practice.",
    points: ["Year-wise previous papers", "Pattern and trend insight", "Real timed-paper experience"],
  },
  {
    icon: FlaskConical,
    label: "Practical Lab",
    description: "Step-by-step practical and lab resources that connect classroom theory to hands-on implementation.",
    points: ["Step-by-step lab procedures", "Viva and experiment guidance", "Implementation-first examples"],
  },
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

/** Fixed alignment point: east (0deg) on desktop, south (90deg) on mobile. */
const WHEEL_ACTIVE_ANGLE = 0;
const WHEEL_ACTIVE_ANGLE_MOBILE = 90;

/** Spin time scales with travel distance: near hops are snappy, far spins
 *  get more time but a higher angular speed — same smooth curve throughout. */
const SPIN_MS_FOR = (deltaDeg: number) => {
  const d = Math.abs(deltaDeg);
  return Math.round(Math.min(1000, Math.max(380, 320 + d * 2.8)));
};

/** True on desktop widths (wheel aligns east); otherwise mobile (south). */
function useDesktop(breakpoint = 1024) {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${breakpoint}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const onChange = (event: MediaQueryListEvent) => setDesktop(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return desktop;
}

/** Cumulative-free rotation landing branch `index` on `activeAngle`. */
const rotationFor = (index: number, activeAngle: number) =>
  (((activeAngle - WHEEL_BASE_ANGLE(index)) % 360) + 360) % 360;

/**
 * Shortest-path delta taking branch `index` from `fromRotation` to `angle.
 * Positive = clockwise, negative = anticlockwise; exact 180° ties go clockwise.
 */
const deltaFor = (index: number, fromRotation: number, angle: number) => {
  const current = (((WHEEL_BASE_ANGLE(index) + fromRotation) % 360) + 360) % 360;
  const clockwise = (((angle - current) % 360) + 360) % 360;
  return clockwise <= 180 ? clockwise : clockwise - 360;
};

export function UniverseSection() {
  const isDesktop = useDesktop();
  // Alignment point follows the layout: east toward the cards on desktop,
  // straight down toward the stacked cards on mobile.
  const activeAngle = isDesktop ? WHEEL_ACTIVE_ANGLE : WHEEL_ACTIVE_ANGLE_MOBILE;
  // Single source of truth: selected branch + cumulative rotation.
  const [selected, setSelected] = useState(0);
  // Book starts pre-aligned (east on desktop, south on mobile).
  const [rotation, setRotation] = useState(() => rotationFor(0, activeAngle));
  const [spinMs, setSpinMs] = useState(700);
  // Synchronous mirror of `rotation` so rapid successive clicks always
  // compute from the latest angle instead of a stale render closure.
  const rotationRef = useRef(rotation);
  // Open card of the stage — trails `selected` so the card opens exactly as
  // the spin lands at the alignment point.
  const [front, setFront] = useState(0);

  useEffect(() => {
    if (selected === front) return;
    const t = window.setTimeout(() => setFront(selected), 650);
    return () => window.clearTimeout(t);
  }, [selected, front]);

  // One-time discovery spin: when the wheel first scrolls into view after a
  // page refresh, rotate a full 360° so visitors see it is interactive. Runs
  // once per page load (ends exactly aligned); user clicks naturally override
  // it mid-flight through the regular rotation path.
  const demoRef = useRef<HTMLDivElement | null>(null);
  const demoPlayed = useRef(false);
  useEffect(() => {
    const el = demoRef.current;
    if (!el || demoPlayed.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            demoPlayed.current = true;
            io.disconnect();
            rotationRef.current += 360;
            setSpinMs(1800);
            setRotation(rotationRef.current);
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Glide the current selection onto the new alignment point when the
  // breakpoint flips (east <-> south). No-op when already aligned.
  const wasDesktop = useRef(isDesktop);
  useEffect(() => {
    if (wasDesktop.current === isDesktop) return;
    wasDesktop.current = isDesktop;
    const delta = deltaFor(selected, rotationRef.current, activeAngle);
    if (delta === 0) return;
    rotationRef.current += delta;
    setSpinMs(SPIN_MS_FOR(delta));
    setRotation(rotationRef.current);
  }, [isDesktop, selected, activeAngle]);

  const Active = WHEEL_TYPES[front];
  // Stable behind-order for the deck (front card excluded, original order kept).
  const behindOrder = WHEEL_TYPES.map((_, i) => i).filter((i) => i !== front);

  const select = (i: number) => {
    if (i === selected) return;
    const delta = deltaFor(i, rotationRef.current, activeAngle);
    rotationRef.current += delta;
    setSpinMs(SPIN_MS_FOR(delta));
    setRotation(rotationRef.current);
    setSelected(i);
  };

  return (
    <section
      aria-labelledby="landing-universe-heading"
      id="library"
      className="scroll-mt-24 border-y border-border bg-surface pb-12 pt-8 lg:pb-16 lg:pt-10"
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

        <div className="mt-10 grid items-center gap-8 sm:mt-12 lg:mt-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        {/* ------ LEFT-DOCKED: resource network ------ */}
        <Reveal className="flex flex-col items-center lg:-mt-12 lg:items-start">
          <div
            ref={demoRef}
            className="relative aspect-square w-full max-w-[300px] sm:max-w-[460px] md:max-w-[520px] lg:max-w-[560px]"
            role="group"
            aria-label="Resource type wheel. Select a resource branch to rotate the wheel."
          >
            {/* fixed alignment markers (never rotate): east on desktop, south on mobile */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-8 sm:inset-10">
              <span className="absolute left-[94%] top-1/2 hidden size-3.5 -translate-y-1/2 translate-x-[56px] rounded-full bg-primary ring-4 ring-primary/20 lg:block" />
              <span className="absolute left-1/2 top-[94%] size-3.5 -translate-x-1/2 translate-y-[36px] rounded-full bg-primary ring-4 ring-primary/20 sm:translate-y-[44px] lg:hidden" />
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
                  className="text-border-strong dark:text-white/50 dark:opacity-60"
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
                              ? "flex size-16 scale-110 flex-col items-center justify-center gap-1 rounded-full border-[3px] border-primary bg-primary p-2 text-center text-primary-foreground shadow-card-hover ring-4 ring-primary/20 transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transform-none sm:size-20 lg:size-24"
                              : "flex size-16 flex-col items-center justify-center gap-1 rounded-full border-[3px] border-border-strong bg-surface p-2 text-center shadow-card transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transform-none dark:border-white/70 dark:hover:border-white sm:size-20 lg:size-24"
                          }
                        >
                          <Icon
                            className={active ? "size-3.5 shrink-0 sm:size-4 lg:size-5" : "size-3.5 shrink-0 text-primary sm:size-4 lg:size-5"}
                            aria-hidden="true"
                          />
                          <span
                            className={
                              active
                                ? "text-[7px] font-extrabold leading-tight sm:text-[8px] lg:text-[9px]"
                                : "text-[7px] font-bold leading-tight text-foreground sm:text-[8px] lg:text-[9px]"
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
            <div className="absolute left-1/2 top-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-primary px-6 text-center text-primary-foreground shadow-card-hover ring-8 ring-primary-muted/60 sm:size-36 lg:size-44">
              <p className="font-display text-base font-extrabold leading-none tracking-tight sm:text-xl lg:text-2xl">
                Resource
                <br />
                Library
              </p>
              <p className="mt-2 text-[9px] font-medium text-primary-foreground/85 sm:text-[10px] lg:text-xs">
                Choose a resource type
              </p>
            </div>
          </div>
        </Reveal>

        {/* ------ RIGHT: playing-card stage ------ */}
        <Reveal delay={120} className="justify-self-stretch lg:mt-12 lg:justify-self-end">
          <div className="flex w-full flex-col items-center">
            <style>{`
              @keyframes wl-card-open {
                from { opacity: 0.5; transform: translateY(24px) scale(0.95) rotateY(-10deg); }
                to { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg); }
              }
              .wl-card-open { animation: wl-card-open 600ms cubic-bezier(0.22, 1, 0.36, 1); transform-style: preserve-3d; }
              @media (prefers-reduced-motion: reduce) { .wl-card-open { animation: none; } }
            `}</style>
            <div
              className="relative mx-2 h-[394px] w-[calc(100%-1rem)] max-w-[420px] [perspective:1200px] sm:mx-0 sm:h-[464px] sm:w-full sm:max-w-[640px] md:max-w-[680px] lg:w-[360px] lg:max-w-none"
              role="group"
              aria-label="Resource cards. The aligned resource type opens on top."
            >
              {WHEEL_TYPES.map(({ icon: Icon, label, description, points }, i) => {
                const isOpen = i === front;
                const depth = isOpen ? 0 : behindOrder.indexOf(i) + 1; // 1..7
                return (
                    <article
                      key={label}
                      aria-label={`${label} card`}
                      aria-hidden={!isOpen}
                      style={{
                        transform: `translateY(${depth * 10 + (isOpen ? 0 : 12)}px) scale(${1 - depth * 0.012})`,
                        zIndex: 30 - depth,
                        opacity: isOpen ? 1 : 0.5,
                      }}
                      className={
                        isOpen
                          ? "wl-card-open pointer-events-auto absolute inset-x-0 top-0 flex h-[310px] w-full flex-col overflow-hidden rounded-2xl border border-primary/40 bg-surface p-4 shadow-card-hover ring-2 ring-primary/20 transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-[380px] sm:p-6 lg:w-[360px]"
                          : "pointer-events-none absolute inset-x-0 top-0 flex h-[310px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-card transition-all duration-500 ease-out motion-reduce:transition-none sm:h-[380px] sm:p-6 lg:w-[360px]"
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-6 -right-6 text-primary/[0.07]"
                      >
                        <Icon className="size-32 sm:size-40" />
                      </span>
                      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-muted text-primary sm:size-11">
                        <Icon className="size-4 sm:size-5" aria-hidden="true" />
                      </span>
                      <span className="font-display mt-3 block text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                        {label}
                      </span>
                      <span className="mt-1.5 block text-[12px] font-medium leading-relaxed text-muted-foreground sm:text-[13px]">
                        {description}
                      </span>
                      <span aria-hidden="true" className="my-3 block h-px w-full bg-border" />
                      <ul className="space-y-1.5">
                        {points.map((point) => (
                          <li
                            key={point}
                            className="flex items-start gap-2 text-[12px] font-medium leading-snug text-muted-foreground sm:text-[13px]"
                          >
                            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
            </div>
            <Link
              to="/login?next=/resources"
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none"
            >
              Explore Library
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <p aria-live="polite" className="sr-only">
              {Active.label}: {Active.description}
            </p>
          </div>
        </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Section 5 — Study experience (static timeline) ---------- */

interface StudyStep {
  n: string;
  title: string;
  text: string;
  detail: string;
  icon: LucideIcon;
}

const STUDY_STEPS: StudyStep[] = [
  {
    n: "01",
    title: "Reading",
    text: "A focused, distraction-free reader for every resource in your library.",
    detail: "Focused reading experience",
    icon: BookOpen,
  },
  {
    n: "02",
    title: "Bookmarks",
    text: "Mark exact pages with notes and jump straight back to them.",
    detail: "Save pages + personal notes",
    icon: Bookmark,
  },
  {
    n: "03",
    title: "Progress",
    text: "Your reading progress is saved to your account automatically.",
    detail: "Automatically saved",
    icon: TrendingUp,
  },
  {
    n: "04",
    title: "Recent Resources",
    text: "Recently opened files are always one tap away.",
    detail: "One-tap access",
    icon: Clock,
  },
  {
    n: "05",
    title: "Continue studying",
    text: "Keep an explicit Continue Reading list and resume anytime.",
    detail: "Resume where you left off",
    icon: Play,
  },
];

export function ReadingSection() {
  return (
    <section
      aria-labelledby="landing-reading-heading"
      id="study"
      className="scroll-mt-24 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
    >
      <div className="block space-y-8 lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:space-y-0">
        {/* Intro on top for mobile, left column on desktop. Static in
            page flow — scrolls naturally with the rest of the page. */}
        <Reveal>
          <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
            Study Experience
          </p>
          <h2
            id="landing-reading-heading"
            className="font-display mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
          >
            Where finding becomes studying.
          </h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-muted-foreground">
            Mero Note carries you past the search with a calm reader, saved
            pages, and your place kept every time you return.
          </p>
          <p className="mt-4 border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-muted-foreground">
            Read, bookmark, track, return and resume in one continuous study flow.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Start on desktop and continue from your phone. Your place is
            always kept.
          </p>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            5 steps · Reader to resume
          </p>
        </Reveal>

        <ol className="relative grid gap-6 sm:gap-8" aria-label="Study flow">
          {STUDY_STEPS.map(({ n, title, text, detail, icon: Icon }, i) => (
            <Reveal as="li" key={n} delay={i * 120} className="group relative">
              {/* Gap rail segment: node bottom edge to next node top edge.
                  Never enters a circle interior — same logic as the
                  Organization timeline (mobile rail). */}
              {i < STUDY_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-6 left-[22px] top-[44px] w-[3px] -translate-x-1/2 bg-primary dark:bg-white sm:-bottom-8"
                />
              )}
              <div className="flex items-start gap-4 text-left">
                {/* Stroke-only circular node — accent color with a soft
                    glow, no animation. Purple in bright mode, white in
                    dark mode. The icon alone gently scales on hover. */}
                <span
                  aria-hidden="true"
                  className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-primary bg-surface text-primary shadow-[0_0_24px_-6px_var(--color-primary)] dark:border-white dark:text-white dark:shadow-[0_0_24px_-6px_rgba(255,255,255,0.35)]"
                >
                  <Icon
                    className="size-4 transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover:scale-125"
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                    <span className="mr-2 font-mono text-sm font-bold text-primary">
                      {n}
                    </span>
                    {title}
                  </h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
                    <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-primary" />
                    {detail}
                  </p>
                </div>
              </div>
              {/* Screen-reader step position */}
              <span className="sr-only">
                Step {i + 1} of {STUDY_STEPS.length}
              </span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Section 6 — Mobile experience ---------- */

const MOBILE_POINTS = [
  {
    n: "01",
    title: "Same account, everywhere",
    text: "One account, one organized library across your desktop and phone.",
  },
  {
    n: "02",
    title: "Built for smaller screens",
    text: "Browse subjects, open resources, and keep studying comfortably from your phone.",
  },
  {
    n: "03",
    title: "Available when you need it",
    text: "Downloaded resources stay available for offline study when you're away from the internet.",
  },
];

const PHONE_FRAME =
  "overflow-hidden rounded-3xl border border-border-strong bg-surface shadow-hero-rest ring-1 ring-black/5 transition-all duration-300 motion-reduce:transition-none";

/** One framed phone screenshot with the shared hover-lift treatment. */
function PhoneShot({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <div
      className={`${PHONE_FRAME} hover:-translate-y-1 hover:scale-[1.02] hover:shadow-hero-glow motion-reduce:transform-none`}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full object-contain"
      />
    </div>
  );
}

/** Showcase slots: side phones tilt from a planted baseline behind the vertical center phone. */
const PHONE_SLOTS = [
  {
    src: "/images/phone3.jpeg",
    alt: "Mero Note study resources on a phone",
    slot: "relative z-10 -mr-8 w-32 shrink-0 origin-bottom -rotate-[9deg] sm:-mr-10 sm:w-40 lg:w-48",
  },
  {
    src: "/images/phone1.jpeg",
    alt: "Mero Note resource library on a phone",
    slot: "relative z-20 w-36 shrink-0 sm:w-44 lg:w-52",
  },
  {
    src: "/images/phone2.jpeg",
    alt: "Mero Note study progress on a phone",
    slot: "relative z-10 -ml-8 w-32 shrink-0 origin-bottom rotate-[9deg] sm:-ml-10 sm:w-40 lg:w-48",
  },
];

export function MobileSection() {
  return (
    <section
      aria-labelledby="landing-mobile-heading"
      className="border-y border-border bg-surface-muted/50 py-8 lg:py-12"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[45fr_55fr] lg:gap-12 lg:px-8">
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
            <ul className="mt-8 space-y-5">
              {MOBILE_POINTS.map(({ n, title, text }) => (
                <li key={n} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="font-display w-7 shrink-0 pt-0.5 text-sm font-extrabold tracking-widest text-primary"
                  >
                    {n}
                  </span>
                  <div>
                    <p className="text-base font-bold text-foreground">{title}</p>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={140}>
          {/* three-phone showcase: shared baseline via items-end */}
          <div className="relative flex items-end justify-center" role="group" aria-label="Mero Note on three phones">
            {PHONE_SLOTS.map(({ src, alt, slot }) => (
              <div key={src} className={slot}>
                <PhoneShot src={src} alt={alt} width={702} height={1600} />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Section 8 — How it works (vertical study journey) ---------- */

const JOURNEY_STEPS: StudyStep[] = [
  {
    n: "01",
    title: "Choose your semester",
    text: "Start where you are in the curriculum.",
    detail: "Semester 01–08",
    icon: Layers,
  },
  {
    n: "02",
    title: "Select your subject",
    text: "Open the subject you need today.",
    detail: "Choose a subject",
    icon: BookOpen,
  },
  {
    n: "03",
    title: "Explore your resources",
    text: "Browse books, notes, questions and papers.",
    detail: "Books · Notes · Questions · Papers",
    icon: Library,
  },
  {
    n: "04",
    title: "Open what you need",
    text: "Read directly, no folder digging.",
    detail: "Open resource",
    icon: FileText,
  },
  {
    n: "05",
    title: "Continue your study",
    text: "Bookmark, track progress, resume anytime.",
    detail: "Resume anytime",
    icon: Play,
  },
];

export function JourneySection() {
  return (
    <section
      aria-labelledby="landing-journey-heading"
      id="how-it-works"
      className="scroll-mt-24 border-t border-border bg-surface-muted/50 py-8 lg:py-12"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="block space-y-8 lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:space-y-0">
          {/* Left: short section intro — the timeline sits to the right */}
          <Reveal>
            <p className="text-xs font-extrabold uppercase tracking-widest text-primary">
              How It Works
            </p>
            <h2
              id="landing-journey-heading"
              className="font-display mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
            >
              From semester to study session.
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
              A simple path from your curriculum to the exact resource you
              need and back to where you left off.
            </p>
            <p className="mt-3 border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-muted-foreground">
              Semester, subject, resources, resume in one guided flow.
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              5 steps, Semester to resume
            </p>
          </Reveal>

          {/* Right: timeline in the shared global style */}
          <ol className="relative grid gap-6 sm:gap-8" aria-label="Study journey">
            {JOURNEY_STEPS.map(({ n, title, text, detail, icon: Icon }, i) => (
              <Reveal as="li" key={n} delay={i * 120} className="group relative">
                {i < JOURNEY_STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-6 left-[22px] top-[44px] w-[3px] -translate-x-1/2 bg-primary dark:bg-white sm:-bottom-8"
                  />
                )}
                <div className="flex items-start gap-4 text-left">
                  <span
                    aria-hidden="true"
                    className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-primary bg-surface text-primary shadow-[0_0_24px_-6px_var(--color-primary)] dark:border-white dark:text-white dark:shadow-[0_0_24px_-6px_rgba(255,255,255,0.35)]"
                  >
                    <Icon
                      className="size-4 transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover:scale-125"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="font-display text-base font-extrabold tracking-tight text-foreground sm:text-lg">
                      <span className="mr-2 font-mono text-sm font-bold text-primary">
                        {n}
                      </span>
                      {title}
                    </h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {text}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="size-1 shrink-0 rounded-full bg-primary"
                      />
                      {detail}
                    </p>
                  </div>
                </div>
                <span className="sr-only">
                  Step {i + 1} of {JOURNEY_STEPS.length}
                </span>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

/** Explore links navigate to the corresponding landing-page sections. */
interface ExploreLink {
  label: string;
  /** Router destination (Home only). */
  to?: string;
  /** Landing section anchor. */
  sectionId?: string;
}

const EXPLORE_LINKS: ExploreLink[] = [
  { label: "Home", to: "/" },
  { label: "Library", sectionId: LANDING_SECTION_IDS.library },
  { label: "Study", sectionId: LANDING_SECTION_IDS.study },
  { label: "How It Works", sectionId: LANDING_SECTION_IDS.howItWorks },
];

/** Protected study resources — every destination sits behind `RequireAuth`. */
const STUDY_LINKS: Array<{ label: string; destination: string }> = [
  { label: "Semesters", destination: STUDY_DESTINATIONS.semesters },
  { label: "Subjects", destination: STUDY_DESTINATIONS.subjects },
  { label: "Resources", destination: STUDY_DESTINATIONS.resources },
  { label: "Books", destination: STUDY_DESTINATIONS.books },
  { label: "Questions", destination: STUDY_DESTINATIONS.questions },
  { label: "Past Papers", destination: STUDY_DESTINATIONS.pastPapers },
];

const ACCOUNT_LINKS: Array<{ label: string; to: string }> = [
  { label: "Login", to: "/login" },
  { label: "Get Started", to: "/register" },
  // Protected by the existing auth gate: guests are sent through /login
  // with `?next=/dashboard` preserved by RequireAuth — no duplicate logic.
  { label: "Dashboard", to: "/dashboard" },
];

const FOOTER_LINK_CLASS =
  "rounded text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function FooterBrand() {
  return (
    <div>
      <Link
        to="/"
        aria-label="Mero Note home"
        className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <img
          src="/icon/icon.png"
          alt="Mero Note"
          width={36}
          height={36}
          loading="lazy"
          className="size-9 shrink-0 rounded-xl object-cover"
        />
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight text-foreground">
            Mero Note
          </span>
          <span className="block text-xs font-medium text-muted-foreground">
            CSIT Study Library
          </span>
        </span>
      </Link>
      <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
        Built for focused CSIT study.
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
        Designed &amp; Developed by Kismat Dahal
      </p>
    </div>
  );
}

function FooterHeading({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-foreground">
      {children}
    </p>
  );
}

/** Explore group: smooth in-page section navigation, no new pages. */
function FooterExplore() {
  const { pathname } = useLocation();

  const handleSection = (sectionId: string) => (e: MouseEvent) => {
    e.preventDefault();
    scrollToLandingSection(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);
  };

  const handleHome = () => {
    if (pathname === "/") {
      scrollToLandingSection(LANDING_SECTION_IDS.top);
      window.history.replaceState(null, "", "/");
    }
  };

  return (
    <div>
      <FooterHeading>Explore</FooterHeading>
      <ul className="mt-3 space-y-2">
        {EXPLORE_LINKS.map((link) => (
          <li key={link.label}>
            {link.to ? (
              <Link to={link.to} onClick={handleHome} className={FOOTER_LINK_CLASS}>
                {link.label}
              </Link>
            ) : (
              <a
                href={`#${link.sectionId}`}
                onClick={handleSection(link.sectionId!)}
                className={FOOTER_LINK_CLASS}
              >
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Study group: protected resources reusing the existing auth system.
 * Guests go through `/login?next=<destination>` (Login honors `next`);
 * authenticated users open the destination directly. No duplicate
 * auth logic — destinations stay behind `RequireAuth` regardless.
 */
function FooterStudy() {
  const { status } = useUser();
  const authed = status === "authed";

  return (
    <div>
      <FooterHeading>Study</FooterHeading>
      <ul className="mt-3 space-y-2">
        {STUDY_LINKS.map((link) => (
          <li key={link.label}>
            <Link
              to={authed ? link.destination : loginWithNext(link.destination)}
              className={FOOTER_LINK_CLASS}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterAccount() {
  return (
    <div>
      <FooterHeading>Account</FooterHeading>
      <ul className="mt-3 space-y-2">
        {ACCOUNT_LINKS.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className={FOOTER_LINK_CLASS}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Real Instagram glyph (lucide-react ships no brand icons).
 * Inherits text color via `currentColor`; decorative only.
 */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

/**
 * Contact group: Instagram only, opened as an external link.
 * The URL comes from `VITE_INSTAGRAM_URL` — never invented here.
 */
function FooterContact() {
  return (
    <div>
      <FooterHeading>Contact</FooterHeading>
      <ul className="mt-3 space-y-2">
        <li>
          {INSTAGRAM_URL ? (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 ${FOOTER_LINK_CLASS}`}
            >
              <InstagramIcon className="size-3.5" />
              Instagram
            </a>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 ${FOOTER_LINK_CLASS}`}
              title="Set VITE_INSTAGRAM_URL to configure the Instagram link"
            >
              <InstagramIcon className="size-3.5" />
              Instagram
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:gap-12">
          <FooterBrand />
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4"
          >
            <FooterExplore />
            <FooterStudy />
            <FooterAccount />
            <FooterContact />
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-1 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-muted-foreground">
            © 2026 Mero Note
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            Built for focused CSIT study.
          </p>
        </div>
      </div>
    </footer>
  );
}
