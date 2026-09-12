import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import type { Resource } from "../../types";
import { Card, PageHeader as _PH } from "../common/PageHeader";
import { ProgressBar } from "../common/ProgressBar";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx } from "../../lib/utils";
import { getSubjectById } from "../../data/selectors";
import { useLibrary } from "../../state/LibraryProvider";

/** Used on the Dashboard "Continue Reading" section. */
export function ContinueReadingCard({ resource }: { resource: Resource }) {
  const { getProgress } = useLibrary();
  const progress = getProgress(resource.id);
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
  const TypeIcon = typeConfig.icon;
  const subject = getSubjectById(resource.subjectId);

  const lastPage = progress?.lastPage ?? 1;
  const ratio = progress?.progress ?? 0;
  const pct = Math.round(ratio * 100);

  return (
    <Link
      to={`/reader/${resource.id}`}
      className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      aria-label={`Continue reading ${resource.title} at page ${lastPage}`}
    >
      <Card interactive className="p-4">
        <div className="flex items-start gap-3.5">
          <div className={cx("flex size-11 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
            <TypeIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
              {resource.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {subject?.name} · Page {lastPage} of {resource.pageCount}
            </p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <ProgressBar value={ratio} label={`Reading progress ${pct}%`} className="flex-1" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{pct}%</span>
            </div>
          </div>
          <span className="mt-1 flex size-9 shrink-0 items-center justify-center self-center rounded-full bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
            <Play className="size-4 translate-x-0.5 fill-current" aria-hidden="true" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
