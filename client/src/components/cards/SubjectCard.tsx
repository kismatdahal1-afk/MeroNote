import { Link } from "react-router-dom";
import { ChevronRight, FileStack, FlaskConical, Heart, Bookmark } from "lucide-react";
import type { Subject } from "../../types";
import { Card } from "../common/PageHeader";
import { Badge } from "../common/Badge";
import { IconButton } from "../common/IconButton";
import { countResourcesBySubject } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";
import { useToast } from "../../state/ToastProvider";

export function SubjectCard({ subject }: { subject: Subject }) {
  const count = countResourcesBySubject(subject.id);
  const { isFavoriteSubject, toggleFavoriteSubject, isSubjectBookmarked, toggleBookmarkSubject } =
    useLibrary();
  const { toast } = useToast();

  const favorite = isFavoriteSubject(subject.id);
  const bookmarked = isSubjectBookmarked(subject.id);

  const handleFavorite = () => {
    toggleFavoriteSubject(subject.id);
    toast(favorite ? `Removed ${subject.name} from favorites` : `Added ${subject.name} to favorites`);
  };

  const handleBookmark = () => {
    toggleBookmarkSubject(subject.id);
    toast(bookmarked ? `Removed bookmark for ${subject.name}` : `Bookmarked ${subject.name}`);
  };

  return (
    <Card interactive className="group relative h-full p-5">
      {/* Stretched link — makes the whole card clickable */}
      <Link
        to={`/subjects/${subject.id}`}
        aria-label={`Open ${subject.name}`}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-primary">{subject.code}</span>
            {subject.category === "practical" && (
              <Badge tone="success">
                <FlaskConical className="size-3" aria-hidden="true" />
                Lab
              </Badge>
            )}
            {subject.category === "elective" && (
              <Badge tone="warning">Elective</Badge>
            )}
          </div>
          <h3 className="mt-2.5 truncate text-base font-bold text-foreground group-hover:text-primary">
            {subject.name}
          </h3>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-0.5">
          <IconButton
            icon={Heart}
            label={favorite ? `Remove ${subject.name} from favorites` : `Add ${subject.name} to favorites`}
            size="sm"
            variant={favorite ? "favorite" : "default"}
            filled={favorite}
            aria-pressed={favorite}
            onClick={handleFavorite}
          />
          <IconButton
            icon={Bookmark}
            label={bookmarked ? `Remove bookmark for ${subject.name}` : `Bookmark ${subject.name}`}
            size="sm"
            variant={bookmarked ? "bookmark" : "default"}
            filled={bookmarked}
            aria-pressed={bookmarked}
            onClick={handleBookmark}
          />
        </div>
      </div>
      <div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {subject.description}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileStack className="size-3.5" aria-hidden="true" />
            {count} resources
          </div>
          <ChevronRight
            className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
      </div>
    </Card>
  );
}
