import { Link } from "react-router-dom";
import { BookOpen, Search, Download, GraduationCap, NotebookPen, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Organized Library",
    text: "Semester → Subject → Resource. Every book, note, and past paper in one calm place.",
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
    text: "Structured around the full CSIT curriculum — all eight semesters.",
  },
];

export default function Welcome() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <NotebookPen className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Mero Note</span>
        </div>
        <Link
          to="/login"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Log in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-20 pt-12 text-center lg:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3.5 py-1.5 text-xs font-medium text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300">
          <GraduationCap className="size-3.5" aria-hidden="true" />
          Personal-first CSIT study library
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Your entire CSIT library,{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
            beautifully organized
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Books, short notes, past papers, and lab materials — arranged by semester
          and subject, readable on any device, downloadable for offline study.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-indigo-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex h-12 items-center rounded-lg border border-slate-300 px-6 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Explore demo
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Icon className="size-5" aria-hidden="true" />
              </div>
              <h2 className="mt-3.5 text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        Mero Note — Phase 2 prototype with mock data
      </footer>
    </div>
  );
}
