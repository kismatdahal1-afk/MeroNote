import type { Subject, Semester } from "../../types";
import { Heart } from "lucide-react";
import { Card } from "../common/PageHeader";
import { CourseMetadata } from "./CourseMetadata";

interface SubjectHeaderProps {
  subject: Subject;
  semester: Semester;
  topicCount: number;
  resourceCount: number;
  favorite: boolean;
  bookmarked: boolean;
  onToggleFavorite: () => void;
  onToggleBookmark: () => void;
}

/** Hero for the Subject/Book detail page: title, description, metadata, actions. */
export function SubjectHeader({
  subject,
  semester,
  topicCount,
  resourceCount,
  favorite,
  bookmarked,
  onToggleFavorite,
  onToggleBookmark,
}: SubjectHeaderProps) {
  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span>{semester.name}</span>
            <span aria-hidden="true">/</span>
            <span className="font-bold text-foreground">{subject.name}</span>
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {subject.name}
          </h1>
          {subject.description && (
            <p className="mt-1.5 max-w-2xl text-sm font-medium text-muted-foreground">
              {subject.description}
            </p>
          )}
          <div className="mt-4">
            <CourseMetadata
              code={subject.code}
              credits={subject.credits}
              fullMarks={subject.fullMarks}
              topicCount={topicCount}
              resourceCount={resourceCount}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? `Remove ${subject.name} from favorites` : `Add ${subject.name} to favorites`}
            className={
              "inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
              (favorite
                ? "bg-error-muted text-error hover:bg-error-muted"
                : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground")
            }
          >
            <Heart
              className="size-4"
              fill={favorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            />
            {favorite ? "Favorited" : "Favorite"}
          </button>
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? `Remove bookmark for ${subject.name}` : `Bookmark ${subject.name}`}
            className={
              "inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
              (bookmarked
                ? "bg-warning-muted text-warning hover:bg-warning-muted"
                : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground")
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill={bookmarked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 3h12v18l-6-4-6 4z" />
            </svg>
            {bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
        </div>
      </div>
    </Card>
  );
}
