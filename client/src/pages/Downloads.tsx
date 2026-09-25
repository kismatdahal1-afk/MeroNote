import { useMemo, useState } from "react";
import { HardDrive, CloudOff, FolderDown } from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { DownloadCard } from "../components/cards/DownloadCard";
import { EmptyState } from "../components/common/States";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ProgressBar } from "../components/common/ProgressBar";
import { Select } from "../components/common/Field";
import { FilterChips } from "../components/resources/FilterChips";
import { formatFileSize } from "../lib/utils";
import { useLibrary } from "../state/LibraryProvider";
import { useToast } from "../state/ToastProvider";
import { useUser } from "../state/UserProvider";
import { ApiError, fetchResource } from "../lib/contentApi";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { useApiQuery } from "../hooks/useApiQuery";
import { DownloadsSkeleton } from "../components/skeletons/pages";
import { ErrorState } from "../components/common/States";
import type { Resource, ResourceType } from "../types";

type SortKey = "recent" | "oldest" | "title" | "size";

export default function Downloads() {
  const {
    downloads,
    removeDownload,
    totalDownloadSize,
    downloadHistory,
    hasLocalFile,
    removeFromDownloads,
    adoptOrphanFile,
    orphanFileIds,
  } = useLibrary();
  const { toast } = useToast();
  const { status } = useUser();
  // Orphan adoption claims files into an account — guests have none, so the
  // section (whose actions could never succeed) stays hidden for them.
  const isGuest = status !== "authed";
  const { semesters, subjects: taxonomySubjects } = useTaxonomy();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingHistoryRemove, setPendingHistoryRemove] = useState<string | null>(null);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  const [semesterId, setSemesterId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  // Combined registry view: device rows plus account-history entries whose
  // bytes are not on this device ("remote" rows render from the same card
  // with a Not-on-this-device state driven by hasLocalFile). Orphan blobs
  // without history stay invisible (Phase 19 reconciliation).
  const remoteRows = useMemo(
    () =>
      downloadHistory
        .filter((h) => !downloads.some((d) => d.resourceId === h.resourceId))
        .map((h) => ({
          id: `dl-remote-${h.resourceId}`,
          resourceId: h.resourceId,
          status: "completed" as const,
          progress: 100,
          sizeBytes: typeof h.fileSize === "number" && h.fileSize > 0 ? h.fileSize : 0,
          downloadedAt: h.downloadedAt,
        })),
    [downloadHistory, downloads],
  );
  const listed = useMemo(() => [...remoteRows, ...downloads], [remoteRows, downloads]);

  // Status transitions (downloading → completed/failed) refetch; per-chunk
  // progress ticks must not — they would refetch every resource per chunk.
  const downloadKey = useMemo(
    () =>
      [...listed.map((d) => `${d.id}:${d.status}`), `history:${downloadHistory.map((h) => h.resourceId).join(",")}`].join(","),
    [listed, downloadHistory],
  );
  const resolved = useApiQuery(`downloads:${downloadKey}`, async (signal) => {
    const rows = await Promise.all(
      listed.map(async (dl) => {
        try {
          const resource = await fetchResource(dl.resourceId, signal);
          return { dl, resource } as const;
        } catch (err) {
          // Deleted/hidden resources stay truthful as unavailable history
          // instead of vanishing; transient failures resolve to null and
          // keep the existing empty/error path.
          if (err instanceof ApiError && err.status === 404) {
            return { dl, resource: null, unavailable: true } as const;
          }
          return null;
        }
      }),
    );
    return rows.filter((e): e is
      | { dl: (typeof listed)[number]; resource: Resource }
      | { dl: (typeof listed)[number]; resource: null; unavailable: true } => Boolean(e));
  });
  const entries = useMemo(() => resolved.data ?? [], [resolved.data]);
  const liveEntries = useMemo(() => entries.filter((e) => e.resource !== null), [entries]);
  const unavailableEntries = useMemo(
    () => entries.filter((e): e is { dl: (typeof listed)[number]; resource: null; unavailable: true } => e.resource === null),
    [entries],
  );

  // Orphan adoption candidates: blobs without history, resolved for display.
  // Dead resources filter out (adoption would 404); their bytes stay until
  // a future cleanup owns them.
  const orphansResolved = useApiQuery(`downloads-orphans:${orphanFileIds.join(",")}`, async (signal) => {
    if (orphanFileIds.length === 0) return [];
    const rows = await Promise.all(
      orphanFileIds.map(async (resourceId) => {
        try {
          const resource = await fetchResource(resourceId, signal);
          return { resourceId, resource };
        } catch {
          return null;
        }
      }),
    );
    return rows.filter((e): e is { resourceId: string; resource: Resource } => Boolean(e));
  });
  const orphanEntries = useMemo(() => orphansResolved.data ?? [], [orphansResolved.data]);

  const handleAdopt = async (resourceId: string) => {
    if (adoptingId) return;
    setAdoptingId(resourceId);
    try {
      const ok = await adoptOrphanFile(resourceId);
      toast(ok ? "Added to Downloads" : "Could not add this file. It may no longer be available.", ok ? "success" : "error");
    } finally {
      setAdoptingId(null);
    }
  };

  const handleRemoveHistory = async () => {
    if (!pendingHistoryRemove) {
      setPendingHistoryRemove(null);
      return;
    }
    const ok = await removeFromDownloads(pendingHistoryRemove);
    toast(ok ? "Removed from Downloads" : "Could not remove. Please try again.", ok ? "success" : "error");
    setPendingHistoryRemove(null);
  };
  const entriesLoading = resolved.loading;
  const entriesError = resolved.error;
  const allSubjects = taxonomySubjects;

  const subjectOptions = useMemo(
    () =>
      semesterId
        ? allSubjects.filter((s) => s.semesterId === semesterId)
        : allSubjects,
    [semesterId],
  );

  const filtered = useMemo(() => {
    // Unavailable entries (deleted/hidden resources) render in their own
    // section below, never through the resource-dependent filters/cards.
    let list = liveEntries;
    if (semesterId) list = list.filter((e) => e.resource.semesterId === semesterId);
    if (subjectId) list = list.filter((e) => e.resource.subjectId === subjectId);
    if (type !== "all") list = list.filter((e) => e.resource.type === type);
    const sorted = [...list];
    if (sort === "title")
      sorted.sort((a, b) => a.resource.title.localeCompare(b.resource.title));
    if (sort === "size")
      sorted.sort((a, b) => b.dl.sizeBytes - a.dl.sizeBytes);
    if (sort === "recent")
      sorted.sort((a, b) => +new Date(b.dl.downloadedAt) - +new Date(a.dl.downloadedAt));
    if (sort === "oldest")
      sorted.sort((a, b) => +new Date(a.dl.downloadedAt) - +new Date(b.dl.downloadedAt));
    return sorted;
  }, [liveEntries, semesterId, subjectId, type, sort]);

  const counts = useMemo(() => {
    let base = liveEntries;
    if (semesterId) base = base.filter((e) => e.resource.semesterId === semesterId);
    if (subjectId) base = base.filter((e) => e.resource.subjectId === subjectId);
    const map: Partial<Record<ResourceType, number>> = {};
    for (const e of base) map[e.resource.type] = (map[e.resource.type] ?? 0) + 1;
    return map;
  }, [liveEntries, semesterId, subjectId]);

  const completedCount = entries.filter((e) => e.dl.status === "completed" && hasLocalFile(e.dl.resourceId)).length;
  const activeCount = entries.filter((e) => e.dl.status === "downloading").length;
  const remoteCount = entries.filter((e) => e.dl.status === "completed" && !hasLocalFile(e.dl.resourceId)).length;

  return (
    <div>
      <PageHeader
        title="Downloads"
        subtitle="Files saved on this device for offline reading."
      />

      {/* Download History — prominent */}
      <Card className="bg-hero-gradient mb-4 p-5 sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <HardDrive className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-foreground">Download History</h2>
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {formatFileSize(totalDownloadSize)}
            <span className="ml-2 text-sm font-semibold text-muted-foreground">
              on this device
            </span>
          </p>
          <div className="mt-3">
            <ProgressBar
              value={entries.length > 0 ? completedCount / entries.length : 0}
              label="Completed downloads"
              className="h-2"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
              <span>
                <span className="font-bold text-foreground">{completedCount}</span> files
                downloaded
              </span>
              {remoteCount > 0 && (
                <span>
                  <span className="font-bold text-foreground">{remoteCount}</span> not on this device
                </span>
              )}
              {activeCount > 0 && (
                <span>
                  <span className="font-bold text-foreground">{activeCount}</span> in progress
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {downloads.length === 0 && downloadHistory.length === 0 && (isGuest || orphanFileIds.length === 0) ? (
        <EmptyState
          title="No downloads yet"
          message="Press the download button on any resource to keep it available offline."
        />
      ) : entriesLoading && entries.length === 0 ? (
        <DownloadsSkeleton />
      ) : entriesError && entries.length === 0 ? (
        <ErrorState message={entriesError} onRetry={resolved.retry} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:flex-nowrap">
            <Select
              id="downloads-semester"
              label=""
              value={semesterId}
              onChange={(e) => {
                setSemesterId(e.target.value);
                setSubjectId("");
              }}
              className="w-full sm:w-48"
              aria-label="Filter by semester"
              options={[
                { value: "", label: "All semesters" },
                ...semesters.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              id="downloads-sort"
              label=""
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full sm:w-48 sm:order-last"
              aria-label="Sort downloads"
              options={[
                { value: "recent", label: "Sort by newest" },
                { value: "oldest", label: "Sort by oldest" },
                { value: "title", label: "Sort by title" },
                { value: "size", label: "Sort by file size" },
              ]}
            />
            <Select
              id="downloads-subject"
              label=""
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="col-span-2 w-full sm:col-span-1 sm:w-56"
              aria-label="Filter by subject"
              options={[
                { value: "", label: "All subjects" },
                ...subjectOptions.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          <div className="mb-5">
            <FilterChips selected={type} counts={counts} onChange={setType} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No downloads found"
              message="No downloads match the current filters."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filtered.map(({ dl, resource }) => (
                <DownloadCard
                  key={dl.id}
                  download={dl}
                  resource={resource}
                  onRemove={setPendingDelete}
                  onRemoveHistory={setPendingHistoryRemove}
                />
              ))}
            </div>
          )}

          {unavailableEntries.length > 0 && (
            <section aria-label="Unavailable downloads" className="mt-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                No longer available
              </h2>
              <div className="space-y-2">
                {unavailableEntries.map(({ dl }) => (
                  <div
                    key={dl.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <CloudOff className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">Previously downloaded resource</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        This file was removed or hidden and can no longer be downloaded.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingHistoryRemove(dl.resourceId)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isGuest && orphanEntries.length > 0 && (
            <section aria-label="Files on this device" className="mt-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                On this device
              </h2>
              <div className="space-y-2">
                {orphanEntries.map(({ resourceId, resource }) => (
                  <div
                    key={resourceId}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <FolderDown className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{resource.title}</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        Local file detected — not in your Downloads yet.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={adoptingId !== null}
                      onClick={() => handleAdopt(resourceId)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary-muted px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                    >
                      {adoptingId === resourceId ? "Adding…" : "Add to Downloads"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
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
            toast("Download deleted");
          }
          setPendingDelete(null);
        }}
      />
      <ConfirmDialog
        open={pendingHistoryRemove !== null}
        title="Remove from Downloads"
        message="This removes the entry from your Downloads history on all devices. Files already saved on this device are kept."
        confirmLabel="Remove"
        danger
        onCancel={() => setPendingHistoryRemove(null)}
        onConfirm={handleRemoveHistory}
      />
    </div>
  );
}
