import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Star, EyeOff } from "lucide-react";
import { PageHeader, Card } from "../../components/common/PageHeader";
import { IconButton } from "../../components/common/IconButton";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/States";
import { Badge } from "../../components/common/Badge";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { useCms } from "../../state/CmsProvider";
import { toggleResourceFeatured, setResourceStatus } from "../../state/cmsStore";
import { useToast } from "../../state/ToastProvider";
import { RESOURCE_TYPE_CONFIG } from "../../lib/resourceType";
import { cx, formatFileSize, formatDate } from "../../lib/utils";
import type { Resource } from "../../types";

/** Featured board: featured resources, ready to unfeature or publish-check. */
export default function AdminFeatured() {
  const db = useCms();
  const { toast } = useToast();
  const [pendingUnfeature, setPendingUnfeature] = useState<Resource | null>(null);

  const featured = useMemo(
    () =>
      db.resources
        .filter((r) => !r.deletedAt && r.featured)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [db.resources],
  );

  const unpublishedFeatured = featured.filter((r) => r.status !== "published");

  return (
    <div>
      <PageHeader
        title="Featured"
        subtitle="Resources starred for the featured board."
        breadcrumbs={[
          { label: "Admin", to: "/admin" },
          { label: "Featured" },
        ]}
        actions={<Badge tone="primary">{featured.length} featured</Badge>}
      />

      {unpublishedFeatured.length > 0 && (
        <Card className="mb-5 border-warning/40 bg-warning-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            {unpublishedFeatured.length} featured resource{unpublishedFeatured.length === 1 ? "" : "s"} not
            published — students can&apos;t see them yet.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unpublishedFeatured.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setResourceStatus(r.id, "published")}
                className="rounded-lg bg-surface px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
              >
                Publish &ldquo;{r.title.slice(0, 30)}&rdquo;
              </button>
            ))}
          </div>
        </Card>
      )}

      {featured.length === 0 ? (
        <EmptyState
          title="Nothing featured"
          message="Use the star action in Resource Management to feature resources."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground/70">
                  <th scope="col" className="px-4 py-3 font-medium">Resource</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {featured.map((r) => {
                  const subject = db.subjects.find((s) => s.id === r.subjectId);
                  const typeConfig = RESOURCE_TYPE_CONFIG[r.type];
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-surface-hover">
                      <td className="max-w-xs px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Star className="size-3.5 shrink-0 fill-current text-warning" aria-hidden="true" />
                          <Link to={`/resources/${r.id}`} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                            {r.title}
                          </Link>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
                          {subject?.name} · {r.pageCount} pages · {formatFileSize(r.fileSize)} · added {formatDate(r.uploadedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", typeConfig.badgeClass)}>
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon={Star}
                            label={`Unfeature ${r.title}`}
                            size="sm"
                            variant="active"
                            filled
                            onClick={() => setPendingUnfeature(r)}
                          />
                          <IconButton
                            icon={EyeOff}
                            label={`Unpublish ${r.title}`}
                            size="sm"
                            disabled={r.status !== "published"}
                            onClick={() => setResourceStatus(r.id, "hidden")}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={pendingUnfeature !== null}
        title="Remove from Featured"
        message={`"${pendingUnfeature?.title}" will no longer be featured. The resource itself stays published.`}
        confirmLabel="Unfeature"
        onCancel={() => setPendingUnfeature(null)}
        onConfirm={() => {
          if (pendingUnfeature) {
            toggleResourceFeatured(pendingUnfeature.id);
            toast("Removed from featured");
          }
          setPendingUnfeature(null);
        }}
      />
    </div>
  );
}
