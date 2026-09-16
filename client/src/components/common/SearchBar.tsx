import { useCallback, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cx } from "../../lib/utils";

interface SearchBarProps {
  initialValue?: string;
  placeholder?: string;
  className?: string;
  onSubmit: (query: string) => void;
  /** Live per-keystroke search callback (optional). */
  onChange?: (query: string) => void;
}

export function SearchBar({ initialValue = "", placeholder = "Search resources...", className, onSubmit, onChange }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  const update = (next: string) => {
    setValue(next);
    onChange?.(next);
  };

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
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        aria-label="Search resources"
        className={cx(
          "h-11 w-full rounded-full border border-border-strong bg-surface pl-11 pr-11 text-sm text-foreground",
          "placeholder:text-muted-foreground/70",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
          // Hide the browser's native search clear button: this bar already has
          // its own single custom clear button below (otherwise two crosses show).
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            update("");
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

/**
 * URL-synced `?q=` search text, shared by the student/admin resource list
 * pages and fed by the portal-aware header search. The query lives in the URL
 * so searches are deep-linkable and survive reloads; unrelated params (such
 * as the student page's `sem`) are preserved when it updates.
 */
export function useSearchQuery(): [query: string, updateQuery: (q: string) => void] {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const updateQuery = useCallback(
    (q: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q) next.set("q", q);
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [query, updateQuery];
}

/**
 * Compact search field used in the header. Portal-aware: inside /admin routes
 * it searches admin content (/admin/resources?q=), everywhere else it searches
 * student content (/resources?q=). Results never cross portal boundaries.
 */
export function HeaderSearch() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <form
      role="search"
      className="relative hidden flex-1 md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = encodeURIComponent(value);
        navigate(isAdmin ? `/admin/resources?q=${q}` : `/resources?q=${q}`);
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
