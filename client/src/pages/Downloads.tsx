import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Eye, HardDrive, CheckCircle2, Loader2 } from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/States";
import { IconButton } from "../components/common/IconButton";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ProgressBar } from "../components/common/ProgressBar";
import { Badge } from "../components/common/Badge";
import { getResourceById, getSubjectById } from "../data/selectors";
import { RESOURCE_TYPE_CONFIG } from "../lib/resourceType";
import { cx, formatFileSize, formatRelativeTime } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";

export default function Downloads() {
  const { downloads, removeDownload, totalDownloadSize, markOpened } = useLibrary();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const completedCount = downloads.filter((d) => d.status === "completed").length;
  const activeCount = downloads.filter((d) => d.status === "downloading").length;

  return (
    <div>
      <PageHeader
        title="Downloads"
        subtitle="Files saved on this device for offline reading."
      />

      {/* Storage summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-lg bg-success-muted text-success">
            <HardDrive className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total storage</p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{formatFileSize(totalDownloadSize)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary-muted text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Downloaded files</p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{completedCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary-muted text-primary">
            <Loader2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">In progress</p>
            <p className="mt-0.5 text-xl font-bold text-foreground">{activeCount}</p>
          </div>
        </Card>
      </div>

      {downloads.length === 0 ? (
        <EmptyState
          title="No downloads yet"
          message="Press the download button on any resource to keep it available offline."
        />
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => {
            const resource = getResourceById(dl.resourceId);
            if (!resource) return null;
            const subject = getSubjectById(resource.subjectId);
            const typeConfig = RESOURCE_TYPE_CONFIG[resource.type];
            const TypeIcon = typeConfig.icon;
            return (
              <Card key={dl.id} className="flex items-center gap-4 p-4">
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
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {subject?.name} Â· {formatFileSize(dl.sizeBytes)}
                  </p>
                  {dl.status === "downloading" && (
                    <div className="mt-2 flex items-center gap-2.5">
                      <ProgressBar value={dl.progress / 100} label={`Download progress ${dl.progress}%`} className="max-w-48" />
                      <span className="text-xs font-medium text-primary">{dl.progress}%</span>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {dl.status === "completed" && (
                    <>
                      <Badge tone="success">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Saved
                      </Badge>
                      <span className="hidden text-xs text-muted-foreground/70 sm:block">
                        {formatRelativeTime(dl.downloadedAt)}
                      </span>
                      <Link
                        to={`/reader/${resource.id}`}
                        onClick={() => markOpened(resource.id)}
                        aria-label={`Open ${resource.title}`}
                        className="flex size-9 items-center justify-center rounded-lg bg-primary-muted text-primary hover:bg-primary-muted-hover"
                      >
                        <Eye className="size-4" aria-hidden="true" />
                      </Link>
                    </>
                  )}
                  <IconButton
                    icon={Trash2}
                    label={`Delete ${resource.title} from downloads`}
                    variant="danger"
                    size="sm"
                    onClick={() => setPendingDelete(dl.id)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete download"
        message="This will remove the downloaded file from this device. You can download it again anytime."
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            removeDownload(pendingDelete);
            toast("Download deleted (mock)");
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
