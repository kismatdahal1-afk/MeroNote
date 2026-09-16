import { useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { ErrorState, EmptyState } from "../components/common/States";
import { BackButton } from "../components/common/BackButton";
import { SubjectHeader } from "../components/subjects/SubjectHeader";
import { SubjectResourceGroup } from "../components/subjects/SubjectResourceGroup";
import { SubjectResourceRow } from "../components/subjects/SubjectResourceRow";
import { ResourceCard } from "../components/cards/ResourceCard";
import {
  getSubjectById,
  getSemesterById,
  getTopicsBySubject,
  getResourcesBySubject,
} from "../data/selectors";
import { entryPointFromState, entryRootFor } from "../lib/resourceNavigation";
import {
  ALL_RESOURCE_TYPES,
  RESOURCE_TYPE_CONFIG,
  resourceTypeLabel,
} from "../lib/resourceType";
import type { Resource, ResourceType } from "../types";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { useCmsSync } from "../components/common/CmsSync";

/** Back-compat: old persisted resources may carry type "other" (now custom). */
function normalizeType(type: ResourceType): ResourceType {
  return (type as string) === "other" ? "custom" : type;
}

/**
 * Student presentation order, derived from the existing Admin
 * "Add Resource → Resource Type" menu (ALL_RESOURCE_TYPES):
 * Book always first, Custom handled separately last.
 */
const TYPE_ORDER: ResourceType[] = [
  "book",
  ...ALL_RESOURCE_TYPES.filter((t) => t !== "book" && t !== "custom"),
];

type GroupTone = "primary" | "secondary" | "accent" | "success" | "warning" | "error";

/** Section tint follows the existing per-type badge color — nothing invented. */
function toneForType(type: ResourceType): GroupTone {
  const badge = RESOURCE_TYPE_CONFIG[type]?.badgeClass ?? "";
  const text = badge
    .split(" ")
    .find((c) => c.startsWith("text-"))
    ?.slice("text-".length);
  return text === "primary" ||
    text === "secondary" ||
    text === "accent" ||
    text === "success" ||
    text === "warning" ||
    text === "error"
    ? text
    : "secondary";
}

function byNewest(a: Resource, b: Resource): number {
  return +new Date(b.uploadedAt) - +new Date(a.uploadedAt);
}

export default function SubjectDetail() {
  const cmsDb = useCmsSync();
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  /** Favorite/Bookmark entry: the subject was opened from a saved list, so
   *  the breadcrumb and resource links keep that entry context. */
  const entry = entryPointFromState(state);
  const entryRoot =
    entry === "favorites" || entry === "bookmarks" ? entryRootFor(entry) : undefined;
  const subjectVia = entryRoot ? entry : undefined;
  const { toast } = useToast();
  const {
    isFavoriteSubject,
    toggleFavoriteSubject,
    isSubjectBookmarked,
    toggleBookmarkSubject,
  } = useLibrary();

  const subject = getSubjectById(subjectId);
  const semester = subject ? getSemesterById(subject.semesterId) : undefined;

  const topics = useMemo(
    () => (subject ? getTopicsBySubject(subject.id) : []),
    // cmsDb: re-resolve after CMS mutations so edits/deletions show immediately.
    [subject, cmsDb],
  );
  const allResources = useMemo(
    () => (subject ? getResourcesBySubject(subject.id) : []),
    // cmsDb: re-resolve after CMS mutations so edits/deletions show immediately.
    [subject, cmsDb],
  );

  /**
   * Read-only presentation of the existing resource data:
   * Books always first, then every other Admin resource type in the
   * menu's canonical order, then Admin-entered custom types last.
   * Empty types render no section.
   */
  const standardGroups = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
        type,
        title: resourceTypeLabel(type),
        resources: allResources
          .filter((r) => normalizeType(r.type) === type)
          .sort(byNewest),
      })).filter((g) => g.resources.length > 0),
    [allResources],
  );

  /** Custom resources grouped by their Admin-entered custom label. */
  const customGroups = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of allResources) {
      if (normalizeType(r.type) !== "custom") continue;
      const key = r.customType?.trim() || "Custom";
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return [...map.entries()].map(([title, resources]) => ({
      title,
      resources: [...resources].sort(byNewest),
    }));
  }, [allResources]);

  const hasResources = standardGroups.length > 0 || customGroups.length > 0;

  if (!subject || !semester) {
    return (
      <ErrorState
        title="Subject not found"
        message="The subject you are looking for does not exist or has been removed."
        onRetry={() => navigate("/semesters")}
      />
    );
  }

  const favorite = isFavoriteSubject(subject.id);
  const bookmarked = isSubjectBookmarked(subject.id);

  const handleToggleFavorite = () => {
    toggleFavoriteSubject(subject.id);
    toast(favorite ? `Removed ${subject.name} from favorites` : `Added ${subject.name} to favorites`);
  };

  const handleToggleBookmark = () => {
    toggleBookmarkSubject(subject.id);
    toast(bookmarked ? `Removed bookmark for ${subject.name}` : `Bookmarked ${subject.name}`);
  };

  const CustomIcon = RESOURCE_TYPE_CONFIG.custom.icon;

  return (
    <div>
      <div className="mb-1 -ml-1 sm:-ml-1">
        <BackButton
          label={entryRoot ? `Back to ${entryRoot.label.toLowerCase()}s` : "Back to semester"}
          fallbackTo={entryRoot ? entryRoot.to : "/dashboard"}
        />
      </div>

      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground md:text-sm">
          {entryRoot ? (
            <>
              <li className="flex items-center gap-1">
                <Link
                  to={entryRoot.to}
                  className="rounded px-1 py-0.5 font-medium hover:text-primary"
                >
                  {entryRoot.label}
                </Link>
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                <span aria-current="page" className="font-semibold text-foreground">
                  {subject.name}
                </span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-1">
                <Link
                  to="/semesters"
                  className="rounded px-1 py-0.5 font-medium hover:text-primary"
                >
                  Semester
                </Link>
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                <Link
                  to={`/semesters/${semester.id}`}
                  className="rounded px-1 py-0.5 font-medium hover:text-primary"
                >
                  {semester.name}
                </Link>
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                <span aria-current="page" className="font-semibold text-foreground">
                  {subject.name}
                </span>
              </li>
            </>
          )}
        </ol>
      </nav>

      <SubjectHeader
        subject={subject}
        semester={semester}
        topicCount={topics.length}
        resourceCount={allResources.length}
        favorite={favorite}
        bookmarked={bookmarked}
        onToggleFavorite={handleToggleFavorite}
        onToggleBookmark={handleToggleBookmark}
      />

      {/* Resources — read-only view of the existing resource data, grouped
          by the Admin resource type. Books always first. */}
      {hasResources ? (
        <>
          {standardGroups.map(({ type, title, resources }) => {
            const SectionIcon = RESOURCE_TYPE_CONFIG[type].icon;
            return (
              <SubjectResourceGroup
                key={type}
                icon={<SectionIcon className="size-4" aria-hidden="true" />}
                title={title}
                count={resources.length}
                tone={toneForType(type)}
              >
                {/* Mobile: existing compact rows. Desktop: Resources-page card grid. */}
                <ul className="space-y-2.5 sm:hidden">
                  {resources.map((r) => (
                    <SubjectResourceRow key={r.id} resource={r} via={subjectVia} />
                  ))}
                </ul>
                <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                  {resources.map((r) => (
                    <ResourceCard key={r.id} resource={r} showContext={false} via={subjectVia} />
                  ))}
                </div>
              </SubjectResourceGroup>
            );
          })}
          {customGroups.map(({ title, resources }) => (
            <SubjectResourceGroup
              key={`custom-${title}`}
              icon={<CustomIcon className="size-4" aria-hidden="true" />}
              title={title}
              count={resources.length}
              tone="secondary"
            >
              {/* Mobile: existing compact rows. Desktop: Resources-page card grid. */}
              <ul className="space-y-2.5 sm:hidden">
                {resources.map((r) => (
                  <SubjectResourceRow key={r.id} resource={r} via={subjectVia} />
                ))}
              </ul>
              <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                {resources.map((r) => (
                  <ResourceCard key={r.id} resource={r} showContext={false} via={subjectVia} />
                ))}
              </div>
            </SubjectResourceGroup>
          ))}
        </>
      ) : (
        <EmptyState
          title="No resources yet"
          message="Resources for this subject will appear here once they are added."
        />
      )}
    </div>
  );
}
