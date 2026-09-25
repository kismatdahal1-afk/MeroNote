import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Bookmark,
  DownloadItem,
  RecentEntry,
  ReadingProgress,
  Resource,
} from "../types";
import { deleteFile, listStoredIds } from "../lib/downloadStore";
import {
  cancelDownloadRequest,
  startDownloadRequest,
} from "../lib/downloadManager";
import { useUser } from "./UserProvider";
import {
  bookmarkRowToBookmark,
  progressRowToProgress,
} from "../lib/personalAdapters";
import {
  buildServerClaimSets,
  libraryMirrorKey,
  removeClaimedBookmarks,
  removeClaimedIds,
  selectGuestBookmarkMerge,
  selectGuestFavoriteMerge,
} from "../lib/librarySync";
import {
  buildCompletedRow,
  downloadMirrorKey,
  mergeRebuiltDownloads,
  unregisteredCompletedRows,
  verifiedCompletedRows,
} from "../lib/downloadRegistry";
import {
  getDownloadHistory,
  registerDownloadHistory,
  type DownloadHistoryRow,
} from "../lib/downloadHistoryApi";
import {
  createBookmark as createServerBookmark,
  deleteBookmarkById as deleteServerBookmarkById,
  deleteFavorite as deleteServerFavorite,
  isObjectIdLike,
  listBookmarks as listServerBookmarks,
  listFavorites as listServerFavorites,
  listProgress as listServerProgress,
  putFavorite as putServerFavorite,
} from "../lib/studyApi";

/**
 * Personal study state: server-authoritative lists (hydrated on login),
 * local-only downloads/recent. Toggles stay optimistic with best-effort
 * write-through; localStorage keeps favorites/bookmarks for guests.
 *
 * Phase 17 lifecycle:
 * - Guest mirrors live under the legacy shared keys (guest namespace).
 * - Each authenticated user hydrates from the server (fetch-all, server
 *   wins) into a `...v2.<userId>` mirror namespace that never leaks across
 *   accounts. In-memory state resets on login/logout/switch so one user's
 *   data never flashes under another user.
 * - Guest saves merge once into a fresh account via the idempotent
 *   favorite/bookmark APIs; guest reading progress stays memory-only.
 */

interface LibraryContextValue {
  favorites: string[];
  isFavorite: (resourceId: string) => boolean;
  toggleFavorite: (resourceId: string) => void;

  /** subject-level favorites (separate from resource favorites) */
  favoriteSubjects: string[];
  isFavoriteSubject: (subjectId: string) => boolean;
  toggleFavoriteSubject: (subjectId: string) => void;

  bookmarks: Bookmark[];
  getBookmark: (resourceId: string) => Bookmark | undefined;
  addBookmark: (resource: Resource, page: number, note?: string) => void;
  removeBookmark: (bookmarkId: string) => void;

  /** subject-level bookmarks (separate from resource bookmarks) */
  bookmarkedSubjects: string[];
  isSubjectBookmarked: (subjectId: string) => boolean;
  toggleBookmarkSubject: (subjectId: string) => void;

  downloads: DownloadItem[];
  getDownload: (resourceId: string) => DownloadItem | undefined;
  startDownload: (resource: Resource) => void;
  cancelDownload: (resourceId: string) => void;
  removeDownload: (downloadId: string) => void;
  totalDownloadSize: number;

  recent: RecentEntry[];
  markOpened: (resourceId: string) => void;

  progress: ReadingProgress[];
  getProgress: (resourceId: string) => ReadingProgress | undefined;
  setReadingProgress: (resourceId: string, page: number, total: number) => void;

  /** Account-level download history (MongoDB: this user downloaded X). */
  downloadHistory: DownloadHistoryRow[];
  /** Account truth: does this user's history include the resource? */
  isAccountDownloaded: (resourceId: string) => boolean;
  /** Device truth: does this device physically hold the PDF bytes? */
  hasLocalFile: (resourceId: string) => boolean;
  /** History entry for a resource, if the account holds one. */
  getHistoryEntry: (resourceId: string) => DownloadHistoryRow | undefined;

  /** True while the account lists are being hydrated after login. */
  isHydrating: boolean;
  /** Last hydration failure, if any (null means empty data is genuine). */
  libraryError: string | null;
  /** Retry the last failed hydration. */
  retryHydration: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

/**
 * Device-local download registry mirrors (completed rows only — blobs live
 * in IndexedDB, never in mirrors). Guests use the legacy v1 key; each
 * account gets an isolated v2.<userId> namespace (see downloadMirrorKey).
 * The v1 key is never auto-migrated into an account (unsafe attribution).
 */
const LEGACY_DOWNLOADS_KEY = "meronote.library.downloads.v1";

function readStored<T>(key: string, fallback: T, validate: (raw: unknown) => T | null): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return validate(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — keep in-memory behavior */
  }
}

function asStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((v): v is string => typeof v === "string");
}

function asDownloadRowArray(raw: unknown): DownloadItem[] | null {
  if (!Array.isArray(raw)) return null;
  const list: DownloadItem[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.resourceId !== "string") continue;
    if (rec.status !== "completed") continue;
    list.push({
      id: rec.id,
      resourceId: rec.resourceId,
      status: "completed",
      progress: 100,
      sizeBytes: typeof rec.sizeBytes === "number" && rec.sizeBytes > 0 ? rec.sizeBytes : 0,
      downloadedAt: typeof rec.downloadedAt === "string" ? rec.downloadedAt : new Date().toISOString(),
    });
  }
  return list;
}

function asBookmarkArray(raw: unknown): Bookmark[] | null {
  if (!Array.isArray(raw)) return null;
  const now = new Date().toISOString();
  const list: Bookmark[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.resourceId !== "string") continue;
    list.push({
      id: rec.id,
      resourceId: rec.resourceId,
      page:
        typeof rec.page === "number" && Number.isFinite(rec.page) && rec.page > 0
          ? Math.floor(rec.page)
          : 1,
      note: typeof rec.note === "string" ? rec.note : "",
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : now,
    });
  }
  return list;
}

/**
 * Remove server-claimed entries from the legacy guest mirrors. Runs only
 * after a successful hydration: entries the account now holds can never be
 * re-merged into a different account on a shared device, while unclaimed
 * entries (merge failures, deleted elsewhere) stay for guest use.
 */
function pruneClaimedGuestMirrors(
  favRows: { targetType: string; targetId: string }[],
  bmRows: { targetType: string; targetId: string }[],
): void {
  if (typeof window === "undefined") return;
  const claimed = buildServerClaimSets(favRows, bmRows);
  const pruneIds = (base: "favorites" | "favoriteSubjects" | "bookmarkedSubjects", set: Set<string>): void => {
    if (set.size === 0) return;
    const key = libraryMirrorKey(base, null);
    const current = readStored(key, [], asStringArray);
    const pruned = removeClaimedIds(current, set);
    if (pruned.length !== current.length) writeStored(key, pruned);
  };
  pruneIds("favorites", claimed.favoriteResourceIds);
  pruneIds("favoriteSubjects", claimed.favoriteSubjectIds);
  pruneIds("bookmarkedSubjects", claimed.bookmarkSubjectIds);
  if (claimed.bookmarkResourceIds.size > 0) {
    const key = libraryMirrorKey("bookmarks", null);
    const current = readStored(key, [], asBookmarkArray);
    const pruned = removeClaimedBookmarks(current, claimed.bookmarkResourceIds);
    if (pruned.length !== current.length) writeStored(key, pruned);
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  // Server is authoritative after hydration; toggles stay optimistic with
  // best-effort write-through. Work is lazy so guests never fire requests.
  const { status, user } = useUser();
  const userId = status === "authed" ? (user?.id ?? null) : null;
  const syncPersonal = (makeWork: () => Promise<unknown>): void => {
    if (status !== "authed") return;
    makeWork().catch(() => {});
  };
  // Identity of the authenticated user for guarding async completions: a
  // hydration or id-swap response must never be applied after logout or a
  // user switch (Phase 16 SemesterStatusProvider uses the same pattern).
  const actorRef = useRef<string | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mergedRef = useRef<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<string[]>(() =>
    readStored(libraryMirrorKey("favorites", null), [], asStringArray),
  );
  const [favoriteSubjects, setFavoriteSubjects] = useState<string[]>(() =>
    readStored(libraryMirrorKey("favoriteSubjects", null), [], asStringArray),
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    readStored(libraryMirrorKey("bookmarks", null), [], asBookmarkArray),
  );
  const [bookmarkedSubjects, setBookmarkedSubjects] = useState<string[]>(() =>
    readStored(libraryMirrorKey("bookmarkedSubjects", null), [], asStringArray),
  );
  /** Server bookmark ids for subject bookmarks — deletes address `:id`. */
  const [subjectBookmarkIds, setSubjectBookmarkIds] = useState<Record<string, string>>({});
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [progress, setProgress] = useState<ReadingProgress[]>([]);
  /** Account download history (MongoDB) for the hydrated user. */
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryRow[]>([]);
  /** Device truth: resource ids whose PDF bytes exist in IndexedDB right now. */
  const [localFileIds, setLocalFileIds] = useState<string[]>([]);
  const nextId = useRef(100);
  // Fresh auth snapshot for completion-time decisions (history registration
  // must use the session active when the bytes land, not a stale closure).
  const authRef = useRef({ status, userId });
  authRef.current = { status, userId };
  // Latest committed device rows (see rebuild/preserve below).
  const downloadsRef = useRef(downloads);
  downloadsRef.current = downloads;

  /* Authenticated lifecycle: reset → merge guests → hydrate (server wins).
   * Logout/guest: reload the guest namespace; never leave another user's
   * in-memory state active. Failures surface via libraryError and keep the
   * cleared state (never mistaken for empty data); retry re-runs hydration.
   *
   * Phase 18 download split: account history hydrates from MongoDB while
   * IndexedDB stays the device truth. Completed device rows rebuild from
   * history ∩ blobs; the legacy v1 registry is never attributed to an
   * account (unsafe) and stays guest-local. */
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    if (status !== "authed" || !userId) {
      setFavorites(readStored(libraryMirrorKey("favorites", null), [], asStringArray));
      setFavoriteSubjects(readStored(libraryMirrorKey("favoriteSubjects", null), [], asStringArray));
      setBookmarks(readStored(libraryMirrorKey("bookmarks", null), [], asBookmarkArray));
      setBookmarkedSubjects(readStored(libraryMirrorKey("bookmarkedSubjects", null), [], asStringArray));
      setSubjectBookmarkIds({});
      setProgress([]);
      setRecent([]);
      setDownloadHistory([]);
      // Guest device view: legacy registry rows whose blobs still exist.
      // Orphan blobs (no row) stay invisible; rows without blobs are dropped.
      const stored = readStored(LEGACY_DOWNLOADS_KEY, [], asDownloadRowArray);
      listStoredIds()
        .then((ids) => {
          if (cancelled) return;
          setDownloads(verifiedCompletedRows(stored, ids));
          setLocalFileIds(ids);
        })
        .catch(() => {
          if (!cancelled) {
            setDownloads([]);
            setLocalFileIds([]);
          }
        });
      setHydratedFor("guest");
      setIsHydrating(false);
      setLibraryError(null);
      return () => {
        cancelled = true;
      };
    }
    // Pre-login guest lists (closure holds the latest committed render state)
    // are the one-time merge source; the reset below prevents any stale flash.
    const guestFavorites = favorites;
    const guestFavoriteSubjects = favoriteSubjects;
    const guestBookmarks = bookmarks;
    const guestBookmarkedSubjects = bookmarkedSubjects;
    const actor = userId;
    actorRef.current = actor;

    setIsHydrating(true);
    setLibraryError(null);
    setFavorites([]);
    setFavoriteSubjects([]);
    setBookmarks([]);
    setBookmarkedSubjects([]);
    setSubjectBookmarkIds({});
    setProgress([]);
    setRecent([]);
    // The previous account's registry view must not flash: drop it now; the
    // device reconciliation below rebuilds this user's view. Blobs stay.
    setDownloads([]);
    setDownloadHistory([]);
    setLocalFileIds([]);

    const alive = (): boolean => !cancelled && actorRef.current === actor;

    void (async () => {
      if (!mergedRef.current.has(actor)) {
        mergedRef.current.add(actor);
        const favMerge = selectGuestFavoriteMerge(guestFavorites, guestFavoriteSubjects);
        for (const id of favMerge.resourceIds) {
          if (!alive()) return;
          await putServerFavorite("resource", id).catch(() => null);
        }
        for (const id of favMerge.subjectIds) {
          if (!alive()) return;
          await putServerFavorite("subject", id).catch(() => null);
        }
        const bmMerge = selectGuestBookmarkMerge(guestBookmarks, guestBookmarkedSubjects);
        for (const entry of bmMerge.resources) {
          if (!alive()) return;
          await createServerBookmark({
            targetType: "resource",
            targetId: entry.targetId,
            page: entry.page,
            note: entry.note,
          }).catch(() => null);
        }
        for (const id of bmMerge.subjectIds) {
          if (!alive()) return;
          await createServerBookmark({ targetType: "subject", targetId: id }).catch(() => null);
        }
      }
      if (!alive()) return;
      const [favRows, bmRows, progRows, dlRows] = await Promise.all([
        listServerFavorites(),
        listServerBookmarks(),
        listServerProgress(),
        getDownloadHistory(),
      ]);
      if (!alive()) return;
      if (favRows && bmRows && progRows && dlRows) {
        setFavorites(favRows.filter((r) => r.targetType === "resource").map((r) => r.targetId));
        setFavoriteSubjects(favRows.filter((r) => r.targetType === "subject").map((r) => r.targetId));
        setBookmarks(bmRows.map(bookmarkRowToBookmark).filter((b): b is Bookmark => b !== null));
        setBookmarkedSubjects(bmRows.filter((r) => r.targetType === "subject").map((r) => r.targetId));
        const subjectIds: Record<string, string> = {};
        for (const row of bmRows) {
          if (row.targetType === "subject" && typeof row._id === "string") subjectIds[row.targetId] = row._id;
        }
        setSubjectBookmarkIds(subjectIds);
        setProgress(progRows.map(progressRowToProgress));
        setDownloadHistory(dlRows);
        // Device reconciliation: completed rows rebuild from account history
        // ∩ physical blobs (either truth alone is insufficient). In-flight
        // device work started before hydration finished is preserved.
        const blobIds = await listStoredIds().catch(() => null);
        if (!alive()) return;
        const blobs = blobIds ?? [];
        setLocalFileIds(blobs);
        const historyIds = new Set(dlRows.map((r) => r.resourceId));
        const rebuilt = dlRows
          .filter((r) => blobs.includes(r.resourceId))
          .map((r) => buildCompletedRow(r, 0));
        setDownloads((prev) => mergeRebuiltDownloads(rebuilt, prev, blobs));
        // Registration retry: blob-verified completed rows the account
        // history lacks — e.g. the history PUT failed (or was skipped) at
        // completion time (§32). Sources are the user's own namespaced
        // mirror plus rows completed inside this hydration window (not yet
        // mirrored). Orphan blobs without rows are never adopted here
        // (Phase 19 reconciliation).
        const mirrorRows = verifiedCompletedRows(
          readStored(downloadMirrorKey(actor), [], asDownloadRowArray),
          blobs,
        );
        const windowRows = verifiedCompletedRows(downloadsRef.current, blobs);
        const candidates = new Map<string, DownloadItem>();
        for (const row of [...mirrorRows, ...windowRows]) {
          if (!candidates.has(row.resourceId) && row.sizeBytes > 0) candidates.set(row.resourceId, row);
        }
        const missing = unregisteredCompletedRows([...candidates.values()], historyIds);
        const synced: DownloadHistoryRow[] = [];
        for (const row of missing) {
          if (!alive()) break;
          const saved = await registerDownloadHistory(row.resourceId, row.sizeBytes).catch(() => null);
          if (saved) synced.push(saved);
        }
        if (!alive()) return;
        if (synced.length > 0) {
          setDownloadHistory((prev) => {
            const ids = new Set(prev.map((r) => r.resourceId));
            const next = [...prev];
            for (const s of synced) {
              if (!ids.has(s.resourceId)) {
                next.push(s);
                ids.add(s.resourceId);
              }
            }
            return next;
          });
          setDownloads((prev) => {
            const ids = new Set(prev.map((d) => d.resourceId));
            const next = [...prev];
            for (const s of synced) {
              if (!ids.has(s.resourceId)) next.push(buildCompletedRow(s, 0));
            }
            return next;
          });
        }
        pruneClaimedGuestMirrors(favRows, bmRows);
        setHydratedFor(actor);
        setLibraryError(null);
      } else {
        // Failure is not empty: fall back to this user's own device mirror
        // (blob-verified completed rows), never another user's state.
        const mirrorRows = readStored(downloadMirrorKey(actor), [], asDownloadRowArray);
        const blobs = await listStoredIds().catch(() => [] as string[]);
        if (!alive()) return;
        setLocalFileIds(blobs);
        setDownloadHistory([]);
        setDownloads(verifiedCompletedRows(mirrorRows, blobs));
        setHydratedFor(actor);
        setLibraryError("Could not load your library. Check your connection and try again.");
      }
      setIsHydrating(false);
    })().catch(() => {
      if (!cancelled && actorRef.current === actor) {
        setHydratedFor(actor);
        setDownloadHistory([]);
        setLibraryError("Could not load your library. Check your connection and try again.");
        setIsHydrating(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // Guest lists intentionally read once per login (not deps): re-running on
    // every toggle would restart hydration and re-merge continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userId, retryCount]);

  /* Write-through per namespace: authed lists persist under v2.<userId>,
   * guest lists under the legacy keys. Gated on hydratedFor so pre-hydration
   * optimistic edits land in the right namespace after hydration replaces. */
  useEffect(() => {
    if (status === "loading" || hydratedFor === null) return;
    if (status === "authed" && userId && hydratedFor === userId) {
      writeStored(libraryMirrorKey("favorites", userId), favorites);
      writeStored(libraryMirrorKey("favoriteSubjects", userId), favoriteSubjects);
      writeStored(libraryMirrorKey("bookmarks", userId), bookmarks);
      writeStored(libraryMirrorKey("bookmarkedSubjects", userId), bookmarkedSubjects);
    } else if (status !== "authed" && hydratedFor === "guest") {
      writeStored(libraryMirrorKey("favorites", null), favorites);
      writeStored(libraryMirrorKey("favoriteSubjects", null), favoriteSubjects);
      writeStored(libraryMirrorKey("bookmarks", null), bookmarks);
      writeStored(libraryMirrorKey("bookmarkedSubjects", null), bookmarkedSubjects);
    }
  }, [favorites, favoriteSubjects, bookmarks, bookmarkedSubjects, hydratedFor, status, userId]);

  /* Device registry mirror (completed rows only): per-user namespace when
   * authed, legacy v1 key for guests. Gated like the personal lists so one
   * account's registry never lands in another namespace. */
  useEffect(() => {
    if (status === "loading" || hydratedFor === null) return;
    const completed = downloads.filter((d) => d.status === "completed");
    if (status === "authed" && userId && hydratedFor === userId) {
      writeStored(downloadMirrorKey(userId), completed);
    } else if (status !== "authed" && hydratedFor === "guest") {
      writeStored(LEGACY_DOWNLOADS_KEY, completed);
    }
  }, [downloads, hydratedFor, status, userId]);

  /* Keep generated bookmark ids unique across reloads (stored ids stay reserved). */
  useEffect(() => {
    const max = bookmarks.reduce((m, b) => {
      const match = /^bm-(\d+)$/.exec(b.id);
      return match ? Math.max(m, Number(match[1])) : m;
    }, 0);
    if (max >= nextId.current) nextId.current = max + 1;
  }, []);

  const isFavorite = useCallback(
    (resourceId: string) => favorites.includes(resourceId),
    [favorites],
  );

  const toggleFavorite = useCallback((resourceId: string) => {
    const adding = !favorites.includes(resourceId);
    setFavorites((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId],
    );
    syncPersonal(() => (adding ? putServerFavorite("resource", resourceId) : deleteServerFavorite("resource", resourceId)));
  }, [favorites, status]);

  const isFavoriteSubject = useCallback(
    (subjectId: string) => favoriteSubjects.includes(subjectId),
    [favoriteSubjects],
  );

  const toggleFavoriteSubject = useCallback((subjectId: string) => {
    const adding = !favoriteSubjects.includes(subjectId);
    setFavoriteSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
    syncPersonal(() => (adding ? putServerFavorite("subject", subjectId) : deleteServerFavorite("subject", subjectId)));
  }, [favoriteSubjects, status]);

  const isSubjectBookmarked = useCallback(
    (subjectId: string) => bookmarkedSubjects.includes(subjectId),
    [bookmarkedSubjects],
  );

  const toggleBookmarkSubject = useCallback((subjectId: string) => {
    const adding = !bookmarkedSubjects.includes(subjectId);
    setBookmarkedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
    if (adding) {
      syncPersonal(() =>
        createServerBookmark({ targetType: "subject", targetId: subjectId }).then((row) => {
          // Drop late responses after logout/user-switch (actor guard).
          if (actorRef.current !== userId) return;
          if (row && typeof row._id === "string") {
            const serverId = row._id;
            setSubjectBookmarkIds((prev) => ({ ...prev, [subjectId]: serverId }));
          }
        }),
      );
    } else {
      const bookmarkId = subjectBookmarkIds[subjectId];
      setSubjectBookmarkIds((prev) => {
        if (!(subjectId in prev)) return prev;
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });
      syncPersonal(() =>
        bookmarkId && isObjectIdLike(bookmarkId)
          ? deleteServerBookmarkById(bookmarkId)
          : Promise.resolve(false),
      );
    }
  }, [bookmarkedSubjects, status, subjectBookmarkIds, userId]);

  const getBookmark = useCallback(
    (resourceId: string) =>
      bookmarks.find((b) => b.resourceId === resourceId),
    [bookmarks],
  );

  const addBookmark = useCallback(
    (resource: Resource, page: number, note?: string) => {
      // Swap the temp id for the server _id on success so a later removal
      // addresses the real row instead of silently no-op'ing server-side.
      const tempId = `bm-${++nextId.current}`;
      setBookmarks((prev) => {
        if (prev.some((b) => b.resourceId === resource.id)) return prev;
        return [
          {
            id: tempId,
            resourceId: resource.id,
            page,
            note: note ?? "",
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
      syncPersonal(() =>
        createServerBookmark({ targetType: "resource", targetId: resource.id, page, note }).then((row) => {
          // Drop late id-swaps after logout/user-switch (actor guard).
          if (actorRef.current !== userId) return;
          if (row && typeof row._id === "string") {
            const serverId = row._id;
            setBookmarks((prev) => prev.map((b) => (b.id === tempId ? { ...b, id: serverId } : b)));
          }
        }),
      );
    },
    [status, userId],
  );

  const removeBookmark = useCallback((bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    // Temp local ids no-op server-side (guarded by isObjectIdLike); server
    // ids sync. Newly created rows reconcile to server ids in addBookmark.
    syncPersonal(() => deleteServerBookmarkById(bookmarkId));
  }, [status]);

  const getDownload = useCallback(
    (resourceId: string) =>
      downloads.find((d) => d.resourceId === resourceId),
    [downloads],
  );

  /** Real download: secure URL → streamed fetch → IndexedDB. Duplicate-safe. */
  const startDownload = useCallback((resource: Resource) => {
    const existing = downloads.find((d) => d.resourceId === resource.id);
    if (existing && (existing.status === "completed" || existing.status === "downloading")) return;
    const rowId = `dl-${resource.id}`;
    setDownloads((prev) => [
      {
        id: rowId,
        resourceId: resource.id,
        status: "downloading",
        progress: 0,
        sizeBytes: resource.fileSize,
        downloadedAt: new Date().toISOString(),
      },
      ...prev.filter((d) => d.resourceId !== resource.id),
    ]);
    void startDownloadRequest(
      { resourceId: resource.id, fileName: resource.fileName ?? `${resource.title}.pdf` },
      {
        onProgress: (percent) => {
          // Indeterminate (null): keep the spinner, never fake numbers.
          if (percent === null) return;
          setDownloads((prev) =>
            prev.map((d) => (d.id === rowId && d.status === "downloading" ? { ...d, progress: percent } : d)),
          );
        },
        onDone: (result, sizeBytes, errorMessage) => {
          if (result === "completed") {
            // Blob write already verified by the manager: only now may the
            // account history be registered (§9 ordering — never before the
            // file exists). The completed row lands regardless; a failed
            // registration stays visible as device truth and is retried at
            // the next hydration (§32) without deleting the valid local PDF.
            setDownloads((prev) =>
              prev.map((d) =>
                d.id === rowId
                  ? { ...d, status: "completed", progress: 100, sizeBytes, downloadedAt: new Date().toISOString() }
                  : d,
              ),
            );
            setLocalFileIds((prev) => (prev.includes(resource.id) ? prev : [...prev, resource.id]));
            const session = authRef.current;
            if (session.status === "authed" && session.userId && isObjectIdLike(resource.id)) {
              const owner = session.userId;
              void registerDownloadHistory(resource.id, sizeBytes)
                .then((row) => {
                  if (authRef.current.userId !== owner) return;
                  setDownloadHistory((prev) =>
                    prev.some((r) => r.resourceId === row.resourceId) ? prev : [...prev, row],
                  );
                })
                .catch(() => {});
            }
          } else if (result === "failed") {
            setDownloads((prev) =>
              prev.map((d) =>
                d.id === rowId ? { ...d, status: "failed", error: errorMessage ?? undefined } : d,
              ),
            );
          } else {
            setDownloads((prev) =>
              prev.map((d) => (d.id === rowId ? { ...d, status: "cancelled", progress: 0 } : d)),
            );
          }
        },
      },
    );
  }, [downloads]);

  const cancelDownload = useCallback((resourceId: string) => {
    // State flips to cancelled via the manager's onDone; no-op when idle.
    cancelDownloadRequest(resourceId);
  }, []);

  const removeDownload = useCallback((downloadId: string) => {
    const row = downloads.find((d) => d.id === downloadId);
    if (row) {
      // Local only: aborts any active fetch and deletes the IndexedDB blob.
      // Never touches B2 or MongoDB (Phase 19 owns history removal).
      cancelDownloadRequest(row.resourceId);
      void deleteFile(row.resourceId).catch(() => {});
      setLocalFileIds((prev) => prev.filter((id) => id !== row.resourceId));
    }
    setDownloads((prev) => prev.filter((d) => d.id !== downloadId));
  }, [downloads]);

  const totalDownloadSize = useMemo(
    () =>
      downloads
        .filter((d) => d.status === "completed")
        .reduce((sum, d) => sum + d.sizeBytes, 0),
    [downloads],
  );

  /** Account truth: this user's download history includes the resource. */
  const isAccountDownloaded = useCallback(
    (resourceId: string) => downloadHistory.some((r) => r.resourceId === resourceId),
    [downloadHistory],
  );

  /** Device truth: this device physically holds the PDF bytes right now. */
  const hasLocalFile = useCallback(
    (resourceId: string) => localFileIds.includes(resourceId),
    [localFileIds],
  );

  const getHistoryEntry = useCallback(
    (resourceId: string) => downloadHistory.find((r) => r.resourceId === resourceId),
    [downloadHistory],
  );

  const markOpened = useCallback((resourceId: string) => {
    setRecent((prev) => [
      { resourceId, openedAt: new Date().toISOString() },
      ...prev.filter((r) => r.resourceId !== resourceId),
    ]);
  }, []);
  const getProgress = useCallback(
    (resourceId: string) => progress.find((p) => p.resourceId === resourceId),
    [progress],
  );

  const setReadingProgress = useCallback(
    (resourceId: string, page: number, total: number) => {
      const ratio = total > 0 ? Math.min(1, page / total) : 0;
      setProgress((prev) => {
        const existing = prev.find((p) => p.resourceId === resourceId);
        if (existing) {
          return prev.map((p) =>
            p.resourceId === resourceId
              ? { ...p, lastPage: page, progress: ratio, updatedAt: new Date().toISOString() }
              : p,
          );
        }
        return [
          ...prev,
          {
            resourceId,
            lastPage: page,
            progress: ratio,
            updatedAt: new Date().toISOString(),
          },
        ];
      });
    },
    [],
  );

  const retryHydration = useCallback(() => {
    setLibraryError(null);
    setRetryCount((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      favorites,
      isFavorite,
      toggleFavorite,
      favoriteSubjects,
      isFavoriteSubject,
      toggleFavoriteSubject,
      bookmarks,
      getBookmark,
      addBookmark,
      removeBookmark,
      bookmarkedSubjects,
      isSubjectBookmarked,
      toggleBookmarkSubject,
      downloads,
      getDownload,
      startDownload,
      cancelDownload,
      removeDownload,
      totalDownloadSize,
      downloadHistory,
      isAccountDownloaded,
      hasLocalFile,
      getHistoryEntry,
      recent,
      markOpened,
      progress,
      getProgress,
      setReadingProgress,
      isHydrating,
      libraryError,
      retryHydration,
    }),
    [
      favorites,
      isFavorite,
      toggleFavorite,
      favoriteSubjects,
      isFavoriteSubject,
      toggleFavoriteSubject,
      bookmarks,
      getBookmark,
      addBookmark,
      removeBookmark,
      bookmarkedSubjects,
      isSubjectBookmarked,
      toggleBookmarkSubject,
      downloads,
      getDownload,
      startDownload,
      cancelDownload,
      removeDownload,
      totalDownloadSize,
      downloadHistory,
      isAccountDownloaded,
      hasLocalFile,
      getHistoryEntry,
      recent,
      markOpened,
      progress,
      getProgress,
      setReadingProgress,
      isHydrating,
      libraryError,
      retryHydration,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
