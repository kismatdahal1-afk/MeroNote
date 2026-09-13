interface WavingHandProps {
  className?: string;
}

/**
 * Waving-hand icon (sign-language greeting style): open palm drawn with
 * lucide-compatible strokes plus motion arcs on both upper sides. Scales
 * with `currentColor` so it follows the active theme like other icons.
 */
export function WavingHand({ className }: WavingHandProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Hand — lucide-style palm, scaled down slightly to make room for wave arcs */}
      <g transform="translate(2.4 2.4) scale(0.8)">
        <path strokeWidth="2.5" d="M18 11V6a2 2 0 0 0-4 0v5" />
        <path strokeWidth="2.5" d="M14 10V4a2 2 0 0 0-4 0v6" />
        <path strokeWidth="2.5" d="M10 10.5V6a2 2 0 0 0-4 0v8" />
        <path
          strokeWidth="2.5"
          d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
        />
      </g>
      {/* Motion arcs — wave lines on both sides of the hand */}
      <path d="M4.8 2.5C3.2 4.1 3.2 5.9 4.8 7.5" />
      <path d="M19.8 1.8C21.4 3.1 21.4 4.5 19.8 5.8" />
    </svg>
  );
}
