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
        className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search resources"
        className={cx(
          "h-10 w-full rounded-full border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900",
          "placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
          "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400",
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
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
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
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search resources, subjects, semesters..."
        aria-label="Search resources"
        className="h-10 w-full max-w-xl rounded-full border border-slate-300 bg-slate-100/70 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-800"
      />
    </form>
  );
}
