import { memo } from "react";
import type { FormEvent } from "react";
import { Search } from "lucide-react";

interface ReaderSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Called on submit (already preventDefaulted by the form). */
  onSubmit: () => void;
  onClose: () => void;
}

/**
 * Document search panel. Presentation only: the submit behavior stays the
 * existing placeholder-toast contract owned by PdfViewer — no PDF text
 * search implementation lives here.
 */
export const ReaderSearchBar = memo(function ReaderSearchBar({ query, onQueryChange, onSubmit, onClose }: ReaderSearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="border-b border-border px-3 py-1">
      <form className="mx-auto flex max-w-xl items-center gap-2" onSubmit={handleSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search in document..."
          aria-label="Search in document"
          className="h-9 w-full rounded-lg border border-border-strong bg-surface-muted px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        />
        {query && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close search"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
});
