const TITLE_WORDS = ["Your", "personal", "study", "library"];

const DESCRIPTION =
  "Your complete CSIT study library, organized your way. Access books, notes, questions, and practical materials anytime";

/** Animated plain-text intro for Mero Note, shown under the dashboard greeting. */
export function ExamCard() {
  return (
    <div className="group px-1 py-1 sm:px-1.5">
      <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
        {TITLE_WORDS.map((word, i) => (
          <span
            key={word}
            className="animate-fade-up inline-block text-[#490BF2] transition-colors duration-300 hover:text-accent hover:underline hover:decoration-2 hover:underline-offset-4 motion-reduce:animate-none dark:text-primary"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {word}
            {i < TITLE_WORDS.length - 1 ? "\u00A0" : ""}
          </span>
        ))}
      </h2>
      <p
        className="animate-fade-up mt-1 max-w-2xl text-xs font-medium leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-foreground sm:text-sm motion-reduce:animate-none"
        style={{ animationDelay: `${TITLE_WORDS.length * 70}ms` }}
      >
        {DESCRIPTION}
      </p>
    </div>
  );
}
