import { Link } from "react-router-dom";
import { BookOpen, Search, Download, GraduationCap, NotebookPen, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Organized Library",
    text: "Semester â†’ Subject â†’ Resource. Every book, note, and past paper in one calm place.",
  },
  {
    icon: Search,
    title: "Fast Search",
    text: "Find any resource by title, subject, semester, type, or tag in seconds.",
  },
  {
    icon: Download,
    title: "Offline Downloads",
    text: "Explicit downloads keep your study files available even without internet.",
  },
  {
    icon: GraduationCap,
    title: "Built for CSIT",
    text: "Structured around the full CSIT curriculum â€” all eight semesters.",
  },
];

export default function Welcome() {
  return (
    <div className="bg-hero-gradient flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <NotebookPen className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">Mero Note</span>
        </div>
        <Link
          to="/login"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Log in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-20 pt-12 text-center lg:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-xs font-semibold text-primary">
          <GraduationCap className="size-3.5" aria-hidden="true" />
          Personal-first CSIT study library
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Your entire CSIT library,{" "}
          <span className="text-primary">
            beautifully organized
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-muted-foreground">
          Books, short notes, past papers, and lab materials â€” arranged by semester
          and subject, readable on any device, downloadable for offline study.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex h-12 items-center rounded-lg border border-border-strong bg-surface px-6 text-base font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Explore demo
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary-muted text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="mt-3.5 text-sm font-bold text-foreground">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs font-medium text-muted-foreground/70">
        Mero Note â€” Phase 2.5 prototype with mock data
      </footer>
    </div>
  );
}
