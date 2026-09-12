import { Link } from "react-router-dom";
import { Bookmark as BookmarkIcon, Trash2, Play } from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/States";
import { IconButton } from "../components/common/IconButton";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { Badge } from "../components/common/Badge";
import { useState } from "react";
import { getResourceById, getSubjectById } from "../data/selectors";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceType";
import { cx, formatDate } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";

export default function Bookmarks() {
  const { bookmarks, removeBookmark, markOpened } = useLibrary();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Bookmarks"
        subtitle="Pages you saved while reading."
      />
      {bookmarks.length === 0 ? (
        <EmptyState
          title="No bookmarks yet"
          message="While reading, tap the bookmark icon to save a page for later."
        />
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bm) => {
            const resource = getResourceById(bm.resourceId);
            if (!resource) return null;
            const subject = getSubjectById(resource.subjectId);
            const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
            const TypeIcon = typeConfig.icon;
            return (
              <Card key={bm.id} className="flex items-center gap-4 p-4">
                <div className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", typeConfig.badgeClass)}>
                  <TypeIcon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/reader/${resource.id}`}
                    onClick={() => markOpened(resource.id)}
                    className="line-clamp-1 text-sm font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                  >
                    {resource.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {subject?.name} · saved {formatDate(bm.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="indigo">
                    <BookmarkIcon className="size-3" aria-hidden="true" />
                    Page {bm.page}
                  </Badge>
                  {bm.note && (
                    <Badge className="hidden sm:inline-flex">{bm.note}</Badge>
                  )}
                  <Link
                    to={`/reader/${resource.id}`}
                    onClick={() => markOpened(resource.id)}
                    aria-label={`Open ${resource.title} at page ${bm.page}`}
                    className="flex size-9 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 hover:bg-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                  >
                    <Play className="size-4" aria-hidden="true" />
                  </Link>
                  <IconButton
                    icon={Trash2}
                    label={`Remove bookmark for ${resource.title}`}
                    variant="danger"
                    size="sm"
                    onClick={() => setPendingDelete(bm.id)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove bookmark"
        message="This bookmark will be removed from your list. The resource itself is not affected."
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            removeBookmark(pendingDelete);
            toast("Bookmark removed");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
