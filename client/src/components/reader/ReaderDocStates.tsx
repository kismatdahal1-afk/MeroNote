import { memo } from "react";
import { FileWarning, Loader2 } from "lucide-react";

/** Loading shimmer for the secure-URL / PDF.js pending states. */
export const ReaderLoadingState = memo(function ReaderLoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8" role="status" aria-label="Loading PDF">
      <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-xs font-semibold text-muted-foreground">{message}</p>
    </div>
  );
});

interface ReaderErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** Friendly error card with optional retry (same contract as before). */
export const ReaderErrorState = memo(function ReaderErrorState({ message, onRetry }: ReaderErrorStateProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
      <FileWarning className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-bold text-foreground">Couldn&apos;t open this PDF</p>
      <p className="max-w-sm text-xs font-medium text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-lg bg-primary-muted px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Try again
        </button>
      )}
    </div>
  );
});
