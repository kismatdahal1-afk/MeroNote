import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cx } from "../../lib/utils";

interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  className?: string;
  onSubmit: (query: string) => void;
}

export function SearchBar({ initialValue = "", placeholder = "Search resources...", className, onSubmit }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      role="search"
      className={cx("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search resources"
        className={cx(
          "h-11 w-full rounded-full border border-border-strong bg-surface pl-11 pr-11 text-sm text-foreground",
          "placeholder:text-muted-foreground/70",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            onSubmit("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}

/** Compact search field used in the header — navigates to /search. */
export function HeaderSearch() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  return (
    <form
      role="search"
      className="relative hidden flex-1 md:block"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/search?q=${encodeURIComponent(value)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search resources, subjects, semesters..."
        aria-label="Search resources"
        className={cx(
          "h-10 w-full max-w-xl rounded-full border border-transparent bg-surface-muted pl-11 pr-4 text-sm text-foreground",
          "placeholder:text-muted-foreground/70",
          "focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/25",
        )}
      />
    </form>
  );
}
