import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  BookOpen, FlaskConical, FileArchive, HelpCircle, Flame, ChevronDown, Download, Eye, HardDrive,
} from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { ErrorState } from "../components/common/States";
import { Badge } from "../components/common/Badge";
import { ProgressBar } from "../components/common/ProgressBar";
import { getSubjectById, getSemesterById, getResourcesBySubject } from "../data/selectors";
import { RESOURCE_TYPE_CONFIG, resourceTypeLabel } from "../lib/resourceType";
import { cx, formatFileSize } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { IconButton } from "../components/common/IconButton";
import type { ResourceType } from "../types";

/** Accordion group: a resource type = one "unit" of the subject. */
const UNIT_ORDER: ResourceType[] = ["book", "short_note", "extra_note", "questions", "past_paper", "important_questions", "practical", "revision_note", "other"];

const UNIT_ICONS: Partial<Record<ResourceType, typeof BookOpen>> = {
  book: BookOpen,
  practical: FlaskConical,
  past_paper: FileArchive,
  questions: HelpCircle,
  important_questions: Flame,
};

export default function SubjectDetail() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startDownload, getDownload, markOpened } = useLibrary();
  const subject = getSubjectById(subjectId);
  const semester = subject ? getSemesterById(subject.semesterId) : undefined;

  const [openUnit, setOpenUnit] = useState<ResourceType | null>("book");

  const resources = useMemo(
    () => (subject ? getResourcesBySubject(subject.id) : []),
    [subject],
  );

  const units = useMemo(() => {
    const map = new Map<ResourceType, typeof resources>();
    for (const type of UNIT_ORDER) {
      const list = resources.filter((r) => r.type === type);
      if (list.length > 0) map.set(type, list);
    }
    return map;
  }, [resources]);

  if (!subject || !semester) {
    return (
      <ErrorState
        title="Subject not found"
        message="The subject you are looking for does not exist or has been removed."
        onRetry={() => navigate("/semesters")}
      />
    );
  }

  const quickStats = [
    { label: "Units", value: units.size },
    { label: "Resources", value: resources.length },
    { label: "Credits", value: subject.credits },
    { label: "Past Papers", value: resources.filter((r) => r.type === "past_paper").length },
  ];

  const syncPct = Math.round(subject.offlineSync * 100);

  return (
    <div>
      <PageHeader
        title={subject.name}
        subtitle={subject.description}
        breadcrumbs={[
          { label: "Semesters", to: "/semesters" },
          { label: semester.name, to: `/semesters/${semester.id}` },
          { label: subject.name },
        ]}
        actions={
          <Badge tone={semester.status === "active" ? "primary" : "neutral"}>
            {subject.code}
          </Badge>
        }
      />

      {/* Course overview: quick stats + offline sync */}
      <Card className="mb-6 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickStats.map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-surface-muted/60 px-4 py-3 text-center">
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <HardDrive className="size-4 text-primary" aria-hidden="true" />
              Offline Sync
            </p>
            <span className={cx("text-sm font-bold", syncPct === 100 ? "text-success" : "text-primary")}>
              {syncPct}%
            </span>
          </div>
          <ProgressBar value={subject.offlineSync} label={`Offline sync ${syncPct}%`} className="mt-2.5" />
        </div>
      </Card>

      {/* TU board hot topics callout */}
      {subject.hotTopics.length > 0 && (
        <Card className="mb-6 border-warning/30 bg-warning-muted/40 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Flame className="size-4 text-warning" aria-hidden="true" />
            TU Board Hot Topics
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {subject.hotTopics.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-warning/30 bg-surface px-3 py-1 text-xs font-bold text-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Unit accordion */}
      <div className="space-y-3">
        {[...units.entries()].map(([type, list]) => {
          const isOpen = openUnit === type;
          const UnitIcon = UNIT_ICONS[type] ?? BookOpen;
          const typeConfig = RESOURCE_TYPE_CONFIG[type];
          const firstResourceId = list[0]?.id;
          return (
            <Card key={type} className="overflow-hidden">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenUnit(isOpen ? null : type)}
                className="flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:bg-surface-hover/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5"
              >
                <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
                  <UnitIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground sm:text-base">
                    {resourceTypeLabel(type)}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {list.length} resource{list.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronDown
                  className={cx(
                    "size-5 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <ul className="divide-y divide-border border-t border-border">
                  {list.map((r) => {
                    const download = getDownload(r.id);
                    return (
                      <li key={r.id} className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/resources/${r.id}`}
                            className="line-clamp-1 text-sm font-bold text-foreground hover:text-primary"
                            onClick={() => markOpened(r.id)}
                          >
                            {r.title}
                          </Link>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                            {r.pageCount} pages · {formatFileSize(r.fileSize)}
                          </p>
                        </div>
                        <Link
                          to={firstResourceId ? `/reader/${r.id}` : "#"}
                          onClick={() => markOpened(r.id)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-muted px-3 text-xs font-bold text-primary hover:bg-primary-muted-hover"
                          aria-label={`Read ${r.title}`}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          Read
                        </Link>
                        {download?.status === "completed" ? (
                          <Badge tone="success">Saved</Badge>
                        ) : (
                          <IconButton
                            icon={Download}
                            label={`Download ${r.title}`}
                            size="sm"
                            onClick={() => {
                              startDownload(r);
                              toast("Download started (mock)");
                            }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
