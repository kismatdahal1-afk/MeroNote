import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** stagger delay in ms (applied as transition-delay) */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}

/**
 * Subtle scroll-reveal wrapper for landing sections.
 * Fades/slides content in once when it enters the viewport.
 * - No animation library, IntersectionObserver only.
 * - Global `prefers-reduced-motion` CSS in index.css collapses the
 *   transition, and `motion-reduce:` utilities remove the transform.
 */
export function Reveal({ children, delay = 0, className = "", as = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as "div";

  return (
    <Tag
      ref={ref}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
      className={
        `transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:transform-none ` +
        (visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0") +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </Tag>
  );
}
