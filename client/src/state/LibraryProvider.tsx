import {
  createContext,
  useCallback,
  useContext,
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

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(seedFavorites);
  const [favoriteSubjects, setFavoriteSubjects] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(seedBookmarks);
  const [bookmarkedSubjects, setBookmarkedSubjects] = useState<string[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>(seedDownloads);
  const [recent, setRecent] = useState<RecentEntry[]>(seedRecent);
  const [progress, setProgress] = useState<ReadingProgress[]>(seedProgress);
  const nextId = useRef(100);

  const isFavorite = useCallback(
    (resourceId: string) => favorites.includes(resourceId),
    [favorites],
  );

  const toggleFavorite = useCallback((resourceId: string) => {
    setFavorites((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId],
    );
  }, []);

  const isFavoriteSubject = useCallback(
    (subjectId: string) => favoriteSubjects.includes(subjectId),
    [favoriteSubjects],
  );

  const toggleFavoriteSubject = useCallback((subjectId: string) => {
    setFavoriteSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  }, []);

  const isSubjectBookmarked = useCallback(
    (subjectId: string) => bookmarkedSubjects.includes(subjectId),
    [bookmarkedSubjects],
  );

  const toggleBookmarkSubject = useCallback((subjectId: string) => {
    setBookmarkedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  }, []);

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
    },
    [],
  );

  const removeBookmark = useCallback((bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }, []);

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
