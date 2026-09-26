import { useEffect, useRef, useState } from "react";

/**
 * Three-image hero composition with a TEMPORARY hover swap.
 *
 * Real screenshots, CSS-only presentation. Fixed default:
 * Dashboard front/center, Semester back-left, note back-right.
 * Hovering a back image glides it to front while the front recedes to
 * that side; leaving restores default. No carousel, no click.
 *
 * Flicker-proofing: mid-flight the receding image slides under the
 * stationary cursor, firing a fresh mouseenter that would re-promote it
 * into a blink loop. While a transition is in flight, enter events are
 * discarded except from the one stationary image, which can only mean a
 * genuine cursor move. Single state (`hoveredId`), one timer.
 */

const DASHBOARD_SRC = "/images/Dashboard.png";
const SEMESTER_SRC = "/images/Semester.png";
const NOTE_SRC = "/images/note.png";

type ImageId = "dashboard" | "semester" | "note";
type Slot = "front" | "left" | "right";

interface HeroImage {
  id: ImageId;
  label: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
  eager: boolean;
}

const IMAGES: HeroImage[] = [
  { id: "dashboard", label: "Dashboard", src: DASHBOARD_SRC, alt: "Mero Note dashboard", width: 1704, height: 923, caption: "Mero Note dashboard preview", eager: true },
  { id: "semester", label: "Semester view", src: SEMESTER_SRC, alt: "Mero Note semester view", width: 1688, height: 932, caption: "Mero Note semester view preview", eager: false },
  { id: "note", label: "Notes view", src: NOTE_SRC, alt: "Mero Note resource and notes view", width: 1688, height: 932, caption: "Mero Note resource and notes view preview", eager: false },
];

const IMAGE_IDS: ImageId[] = ["dashboard", "semester", "note"];

const DEFAULT_SLOT: Record<ImageId, Slot> = {
  dashboard: "front",
  semester: "left",
  note: "right",
};

/** Slot geometry — shared by every state, never edited per interaction.
    Sized to fit the desktop container (aspect-[2.75/1]): the 64%-wide
    front shot (1704×923) fills ~0.347 of container height, sides sit
    above the bottom edge. */
const SLOT_STYLES: Record<Slot, string> = {
  front: "left-[18%] top-0 z-10 w-[64%] rotate-0 scale-100 cursor-default",
  left: "bottom-[8%] -left-[1%] z-0 w-[33%] -rotate-[5deg] scale-[0.97] cursor-pointer",
  right: "bottom-[8%] -right-[1%] z-0 w-[33%] rotate-[5deg] scale-[0.97] cursor-pointer",
};

/** Mobile-only slot geometry: same front/side arrangement, scaled for
    narrow screens (front ~70% centered, sides ~36% tucked behind).
    Container aspect-[2.64/1] fits the 70%-wide front shot (1704×923)
    with the 36% sides (1688×932) anchored at bottom-[6%]. */
const MOBILE_SLOT_STYLES: Record<Slot, string> = {
  front: "left-[15%] top-0 z-10 w-[70%] rotate-0 scale-100 cursor-default",
  left: "bottom-[6%] -left-[2%] z-0 w-[36%] -rotate-[5deg] scale-[0.97] cursor-pointer",
  right: "bottom-[6%] -right-[2%] z-0 w-[36%] rotate-[5deg] scale-[0.97] cursor-pointer",
};

/** Strong shadow for the hover-promoted image (border untouched).
    Theme-aware token: black in light mode, soft light in dark mode. */
const GLOW_SHADOW = "shadow-hero-glow";

/** Elevated resting shadow every hero image carries at all times. */
const REST_SHADOW = "shadow-hero-rest";

/** Staggered entrance delays (run once on mount). */
const ENTRANCE_DELAY: Record<ImageId, number> = {
  dashboard: 120,
  semester: 320,
  note: 480,
};

/** Smooth travel: layout + transform + shadow on a soft ease-out curve. */
const TRAVEL_MS = 650;
const SWAP_TRANSITION =
  `transition-[left,top,width,scale,rotate,box-shadow] duration-[650ms] ` +
  `ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`;
/** Covers the travel so travel-induced enters land inside the lock. */
const FLIGHT_LOCK_MS = TRAVEL_MS + 50;
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function ShotFigure({ image, shadowClass = "" }: { image: HeroImage; shadowClass?: string }) {
  return (
    <figure className={`relative overflow-hidden rounded-xl bg-surface ${shadowClass}`}>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={image.eager ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full object-contain"
      />
      <figcaption className="sr-only">{image.caption}</figcaption>
    </figure>
  );
}

function slotFor(id: ImageId, hoveredId: ImageId | null): Slot {
  if (hoveredId === null) return DEFAULT_SLOT[id];
  if (id === hoveredId) return "front";
  if (id === "dashboard") return DEFAULT_SLOT[hoveredId];
  return DEFAULT_SLOT[id];
}

export function ProductComposition() {
  /** Single source of truth: hovered BACK image, or null for default. */
  const [hoveredId, setHoveredId] = useState<ImageId | null>(null);
  // Ref mirror so rapid-fire events never read a stale closure value.
  const hoveredRef = useRef<ImageId | null>(null);
  const lockTimer = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const stableRef = useRef<ImageId | null>(null);

  useEffect(() => () => {
    if (lockTimer.current !== null) window.clearTimeout(lockTimer.current);
  }, []);

  function setHovered(id: ImageId | null) {
    hoveredRef.current = id;
    setHoveredId(id);
  }

  function clearFlight() {
    if (lockTimer.current !== null) {
      window.clearTimeout(lockTimer.current);
      lockTimer.current = null;
    }
    lockedRef.current = false;
    stableRef.current = null;
  }

  function promote(id: ImageId) {
    clearFlight();
    const front: ImageId = hoveredRef.current ?? "dashboard";
    stableRef.current = IMAGE_IDS.find((key) => key !== id && key !== front) ?? null;
    setHovered(id);
    if (!prefersReducedMotion()) {
      lockedRef.current = true;
      lockTimer.current = window.setTimeout(clearFlight, FLIGHT_LOCK_MS);
    }
  }

  function restore() {
    if (hoveredRef.current === null) return;
    clearFlight();
    setHovered(null);
  }

  function handleEnter(id: ImageId) {
    if (id === (hoveredRef.current ?? "dashboard")) return;
    if (lockedRef.current && id !== stableRef.current) return;
    promote(id);
  }

  /** One interactive shot; desktop and mobile share all behavior and differ
      only in slot geometry. */
  function renderShot(image: HeroImage, styles: Record<Slot, string>) {
    const slot = slotFor(image.id, hoveredId);
    const isFront = slot === "front";
    const isPromoted = hoveredId === image.id;
    const shadow = isPromoted ? GLOW_SHADOW : REST_SHADOW;
    return (
      <div
        key={image.id}
        tabIndex={isFront ? undefined : 0}
        aria-label={isFront ? undefined : `Preview ${image.label} in front`}
        onMouseEnter={isFront ? undefined : () => handleEnter(image.id)}
        onFocus={isFront ? undefined : () => handleEnter(image.id)}
        onBlur={isFront ? undefined : restore}
        // Touch fallback: taps promote via emulated mouseenter, but the
        // container mouseleave may never fire on touch — tapping the
        // promoted image restores default. Default dashboard front
        // stays click-free.
        onClick={isPromoted ? restore : undefined}
        style={{ animationDelay: `${ENTRANCE_DELAY[image.id]}ms` }}
        className={
          `animate-fade-up absolute rounded-xl motion-reduce:animate-none ${SWAP_TRANSITION} ${FOCUS_RING} ` +
          `${styles[slot]} ${shadow}`
        }
      >
        <ShotFigure image={image} />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop / tablet: temporary hover swap. Container-level leave is
          the single restore path for every slot arrangement. */}
      <div
        className="relative mx-auto hidden aspect-[2.75/1] w-full max-w-6xl md:block"
        onMouseLeave={restore}
      >
        {IMAGES.map((image) => renderShot(image, SLOT_STYLES))}
      </div>

      {/* Mobile: same front/side arrangement, scaled for narrow screens.
          Tap a side preview to bring it forward, tap it again to restore. */}
      <div
        className="relative mx-auto aspect-[2.64/1] w-full max-w-md md:hidden"
        onMouseLeave={restore}
      >
        {IMAGES.map((image) => renderShot(image, MOBILE_SLOT_STYLES))}
      </div>
    </div>
  );
}
