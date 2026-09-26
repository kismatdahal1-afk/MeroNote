/**
 * The signature three-image product composition.
 *
 * Uses the REAL Mero Note screenshots, byte-identical — only the CSS
 * container (rounded corners, border, shadow, positioning) presents them:
 * - Dashboard.png  — hero, largest, centered, dominant
 * - Semester.png   — secondary, offset behind/beside the dashboard
 * - Resource_iPhone.png — vertical mobile companion on the side
 *
 * Desktop: one intentional editorial composition with controlled overlap.
 * Mobile browser: recomposed vertical stack (Dashboard → Semester → phone)
 * so every screenshot stays readable instead of shrunken.
 */

const DASHBOARD_SRC = "/images/Dashboard.png";
const SEMESTER_SRC = "/images/Semester.png";
const IPHONE_SRC = "/images/Resource_iPhone.png";

function DashboardFrame({ eager }: { eager: boolean }) {
  return (
    <figure className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-card-hover ring-1 ring-black/5">
      <img
        src={DASHBOARD_SRC}
        alt="Mero Note dashboard"
        width={1280}
        height={800}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full object-contain"
      />
      <figcaption className="sr-only">Mero Note student dashboard preview</figcaption>
    </figure>
  );
}

function SemesterFrame() {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-card-hover ring-1 ring-black/5">
      <img
        src={SEMESTER_SRC}
        alt="Mero Note semester and subject library"
        width={1280}
        height={800}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full object-contain"
      />
      <figcaption className="sr-only">Mero Note semester and subject library preview</figcaption>
    </figure>
  );
}

function IphoneFrame() {
  return (
    <figure className="overflow-hidden rounded-[1.75rem] border border-border-strong bg-surface shadow-card-hover ring-1 ring-black/5">
      <img
        src={IPHONE_SRC}
        alt="Mero Note mobile resource library"
        width={420}
        height={880}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full object-contain"
      />
      <figcaption className="sr-only">Mero Note mobile resource library preview</figcaption>
    </figure>
  );
}

export function ProductComposition() {
  return (
    <div className="w-full">
      {/* Desktop / tablet editorial composition */}
      <div className="relative mx-auto hidden w-full max-w-5xl md:block">
        <div
          className="animate-fade-up relative z-10 mx-auto w-[68%] motion-reduce:animate-none"
          style={{ animationDelay: "120ms" }}
        >
          <DashboardFrame eager />
        </div>
        <div
          className="animate-fade-up absolute -left-[1%] bottom-[6%] z-0 w-[31%] -rotate-[2deg] motion-reduce:animate-none"
          style={{ animationDelay: "320ms" }}
        >
          <SemesterFrame />
        </div>
        <div
          className="animate-fade-up absolute -right-[1%] bottom-0 z-20 w-[15%] min-w-[124px] rotate-[2deg] motion-reduce:animate-none"
          style={{ animationDelay: "480ms" }}
        >
          <IphoneFrame />
        </div>
      </div>

      {/* Mobile browser: vertical recomposition, full readability */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 md:hidden">
        <div className="animate-fade-up motion-reduce:animate-none" style={{ animationDelay: "120ms" }}>
          <DashboardFrame eager />
        </div>
        <div className="animate-fade-up mx-6 motion-reduce:animate-none" style={{ animationDelay: "280ms" }}>
          <SemesterFrame />
        </div>
        <div
          className="animate-fade-up mx-auto w-44 motion-reduce:animate-none"
          style={{ animationDelay: "420ms" }}
        >
          <IphoneFrame />
        </div>
      </div>
    </div>
  );
}
