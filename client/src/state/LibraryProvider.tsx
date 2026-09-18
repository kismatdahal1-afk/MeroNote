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
import {
  getResourceById,
  getResourcesBySubject,
} from "../data/selectors";
import {
  seedBookmarks,
  seedDownloads,
  seedFavorites,
  seedProgress,
  seedRecent,
} from "../data/mock";
import { useUser } from "./UserProvider";
import {
  createBookmark as createServerBookmark,
  deleteBookmarkById as deleteServerBookmarkById,
  deleteFavorite as deleteServerFavorite,
  putFavorite as putServerFavorite,
} from "../lib/studyApi";

/**
 * Phase 2 mock application state.
 * All actions are local/UI-only; they will be replaced by API
 * calls + local storage layers in later phases.
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
  removeDownload: (downloadId: string) => void;
  totalDownloadSize: number;

  recent: RecentEntry[];
  markOpened: (resourceId: string) => void;

  progress: ReadingProgress[];
  getProgress: (resourceId: string) => ReadingProgress | undefined;
  setReadingProgress: (resourceId: string, page: number, total: number) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

/**
 * Persistence for the save-lists (frontend only — same pattern as the theme,
 * user, CMS and semester-status providers). Without this, every browser
 * refresh resets favorites/bookmarks to seeds and wipes ALL saved subjects
 * (which have no seeds), on both desktop and mobile.
 */
const STORAGE_KEYS = {
  favorites: "meronote.library.favorites.v1",
  favoriteSubjects: "meronote.library.favoriteSubjects.v1",
  bookmarks: "meronote.library.bookmarks.v1",
  bookmarkedSubjects: "meronote.library.bookmarkedSubjects.v1",
} as const;

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

export function LibraryProvider({ children }: { children: ReactNode }) {
  // Server sync is best-effort only (see lib/studyApi): local state stays
  // authoritative until academic-content integration swaps in real ids.
  // Work is lazy so guests never fire pointless requests.
  const { status } = useUser();
  const syncPersonal = (makeWork: () => Promise<unknown>): void => {
    if (status !== "authed") return;
    makeWork().catch(() => {});
  };
  const [favorites, setFavorites] = useState<string[]>(() =>
    readStored(STORAGE_KEYS.favorites, seedFavorites, asStringArray),
  );
  const [favoriteSubjects, setFavoriteSubjects] = useState<string[]>(() =>
    readStored(STORAGE_KEYS.favoriteSubjects, [], asStringArray),
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    readStored(STORAGE_KEYS.bookmarks, seedBookmarks, asBookmarkArray),
  );
  const [bookmarkedSubjects, setBookmarkedSubjects] = useState<string[]>(() =>
    readStored(STORAGE_KEYS.bookmarkedSubjects, [], asStringArray),
  );
  const [downloads, setDownloads] = useState<DownloadItem[]>(seedDownloads);
  const [recent, setRecent] = useState<RecentEntry[]>(seedRecent);
  const [progress, setProgress] = useState<ReadingProgress[]>(seedProgress);
  const nextId = useRef(100);

  /* Write-through: every save/unsave survives reloads on desktop and mobile. */
  useEffect(() => {
    writeStored(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.favoriteSubjects, favoriteSubjects);
  }, [favoriteSubjects]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.bookmarks, bookmarks);
  }, [bookmarks]);
  useEffect(() => {
    writeStored(STORAGE_KEYS.bookmarkedSubjects, bookmarkedSubjects);
  }, [bookmarkedSubjects]);

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
    // Removal has no server id to address pre-integration (delete is by :id),
    // so only creations sync; full two-way sync arrives with real ids.
    if (adding) syncPersonal(() => createServerBookmark({ targetType: "subject", targetId: subjectId }));
  }, [bookmarkedSubjects, status]);

  const getBookmark = useCallback(
    (resourceId: string) =>
      bookmarks.find((b) => b.resourceId === resourceId),
    [bookmarks],
  );

  const addBookmark = useCallback(
    (resource: Resource, page: number, note?: string) => {
      setBookmarks((prev) => {
        if (prev.some((b) => b.resourceId === resource.id)) return prev;
        return [
          {
            id: `bm-${++nextId.current}`,
            resourceId: resource.id,
            page,
            note: note ?? "",
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
      syncPersonal(() => createServerBookmark({ targetType: "resource", targetId: resource.id, page, note }));
    },
    [status],
  );

  const removeBookmark = useCallback((bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    // Mock ids no-op server-side; server-issued ids sync once hydrated.
    syncPersonal(() => deleteServerBookmarkById(bookmarkId));
  }, [status]);

  const getDownload = useCallback(
    (resourceId: string) =>
      downloads.find((d) => d.resourceId === resourceId),
    [downloads],
  );

  /** Simulated download with progress updates; no real storage is written. */
  const startDownload = useCallback((resource: Resource) => {
    const downloadId = `dl-${++nextId.current}`;
    setDownloads((prev) => [
      {
        id: downloadId,
        resourceId: resource.id,
        status: "downloading",
        progress: 0,
        sizeBytes: resource.fileSize,
        downloadedAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    const timer = window.setInterval(() => {
      setDownloads((prev) =>
        prev.map((d) => {
          if (d.id !== downloadId || d.status !== "downloading") return d;
          const next = d.progress + 12 + Math.random() * 16;
          if (next >= 100) {
            window.clearInterval(timer);
            return { ...d, status: "completed" as const, progress: 100 };
          }
          return { ...d, progress: Math.round(next) };
        }),
      );
    }, 260);
  }, []);

  const removeDownload = useCallback((downloadId: string) => {
    setDownloads((prev) => prev.filter((d) => d.id !== downloadId));
  }, []);

  const totalDownloadSize = useMemo(
    () =>
      downloads
        .filter((d) => d.status === "completed")
        .reduce((sum, d) => sum + d.sizeBytes, 0),
    [downloads],
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
      removeDownload,
      totalDownloadSize,
      recent,
      markOpened,
      progress,
      getProgress,
      setReadingProgress,
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
      removeDownload,
      totalDownloadSize,
      recent,
      markOpened,
      progress,
      getProgress,
      setReadingProgress,
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

/** Unused helper kept out of context: resources of a subject (mock layer). */
export function subjectResources(subjectId: string): Resource[] {
  return getResourcesBySubject(subjectId);
}

/** Find a resource by id (mock layer convenience). */
export function findResource(resourceId: string): Resource | undefined {
  return getResourceById(resourceId);
}
