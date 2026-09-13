import { Link } from "react-router-dom";
import { History, Play } from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/States";
import { Badge } from "../components/common/Badge";
import { getResourceById, getSubjectById } from "../data/selectors";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceType";
import { cx, formatRelativeTime } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";

export default function Recent() {
  const { recent, markOpened, progress } = useLibrary();

  return (
    <div>
      <PageHeader
        title="Recent"
        subtitle="Resources you opened recently."
      />
      {recent.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message="Resources you open will be listed here for quick access."
        />
      ) : (
        <div className="space-y-3">
          {recent.map((entry) => {
            const resource = getResourceById(entry.resourceId);
            if (!resource) return null;
            const subject = getSubjectById(resource.subjectId);
            const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
            const TypeIcon = typeConfig.icon;
            const prog = progress.find((p) => p.resourceId === resource.id);
            return (
              <Card key={entry.resourceId + entry.openedAt} className="flex items-center gap-4 p-4">
                <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
                  <TypeIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/resources/${resource.id}`}
                    className="line-clamp-1 text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {resource.title}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <History className="size-3" aria-hidden="true" />
                    {subject?.name} Â· opened {formatRelativeTime(entry.openedAt)}
                  </p>
                </div>
                {prog && (
                  <Badge tone="primary" className="hidden sm:inline-flex">
                    Page {prog.lastPage}
                  </Badge>
                )}
                <Link
                  to={`/reader/${resource.id}`}
                  onClick={() => markOpened(resource.id)}
                  aria-label={`Continue reading ${resource.title}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary hover:bg-primary-muted-hover"
                >
                  <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
