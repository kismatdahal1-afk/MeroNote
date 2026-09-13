import { Link } from "react-router-dom";
import { Bookmark as BookmarkIcon, Trash2, Play, HardDrive, WifiOff } from "lucide-react";
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

const SAVE_CHIPS = ["Books", "Past Papers", "Lab Code", "Cheatsheets"];

export default function Bookmarks() {
  const { bookmarks, removeBookmark, markOpened, totalDownloadSize } = useLibrary();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Saved & Bookmarks"
        subtitle="Pages you saved while reading — available offline."
      />

      {/* Offline storage indicator */}
      <Card className="mb-6 flex items-center gap-4 p-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
          <HardDrive className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            {formatBytes(totalDownloadSize)} used
          </p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <WifiOff className="size-3.5" aria-hidden="true" />
            100% Offline Accessible
          </p>
        </div>
        <Badge tone="success">Synced</Badge>
      </Card>

      {/* Filter chips */}
      <div
        role="group"
        aria-label="Filter saved resources"
        className="mb-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SAVE_CHIPS.map((chip, i) => (
          <button
            key={chip}
            type="button"
            aria-pressed={i === 0}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              i === 0
                ? "bg-primary text-primary-foreground"
                : "border border-border-strong bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {chip}
          </button>
        ))}
      </div>

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
                    className="line-clamp-1 text-sm font-bold text-foreground hover:text-primary"
                  >
                    {resource.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                    {subject?.name} · saved {formatDate(bm.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="primary">
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
                    className="flex size-9 items-center justify-center rounded-lg bg-primary-muted text-primary hover:bg-primary-muted-hover"
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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}
