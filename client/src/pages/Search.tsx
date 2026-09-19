import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Book, BookOpen, ChevronRight, FileText, GraduationCap } from "lucide-react";
import { PageHeader, Card } from "../components/common/PageHeader";
import { SearchBar, useSearchQuery } from "../components/common/SearchBar";
import { EmptyState } from "../components/common/States";
import { SkeletonCards } from "../components/common/Skeleton";
import { searchContent, SearchError, type SearchPagination, type SearchResultRow } from "../lib/searchApi";

type SearchState = "idle" | "loading" | "ready" | "error";

const GROUP_ORDER = ["subject", "resource", "topic", "book", "semester", "notice"] as const;
const GROUP_TITLES: Record<string, string> = {
  subject: "Subjects",
  resource: "Resources",
  topic: "Topics",
  book: "Books",
  semester: "Semesters",
  notice: "Notices",
};

function GroupIcon({ entityType }: { entityType: string }) {
  const className = "size-4.5 shrink-0 text-primary";
  switch (entityType) {
    case "subject":
      return <BookOpen className={className} aria-hidden="true" />;
    case "book":
      return <Book className={className} aria-hidden="true" />;
    case "semester":
      return <GraduationCap className={className} aria-hidden="true" />;
    case "notice":
      return <Bell className={className} aria-hidden="true" />;
    default:
      return <FileText className={className} aria-hidden="true" />;
  }
}

function metaLine(row: SearchResultRow): string | null {
  const meta = row.metadata as Record<string, unknown>;
  const text = (v: unknown): string | null => (typeof v === "string" || typeof v === "number" ? String(v) : null);
  switch (row.entityType) {
    case "resource": {
      const parts = [text(meta.type), typeof meta.pageCount === "number" ? `${meta.pageCount} pages` : null, text(meta.subjectName)];
      return parts.filter(Boolean).join(" · ") || null;
    }
    case "subject": {
      const parts = [text(meta.code), text(meta.semesterName)];
      return parts.filter(Boolean).join(" · ") || null;
    }
    case "topic":
      return text(meta.subjectName);
    case "book": {
      const parts = [text(meta.author), text(meta.subjectName)];
      return parts.filter(Boolean).join(" · ") || null;
    }
    case "semester":
      return typeof meta.number === "number" ? `Semester ${meta.number}` : null;
    case "notice":
      return text(meta.type);
    default:
      return null;
  }
}

function destinationFor(row: SearchResultRow): string {
  const meta = row.metadata as Record<string, unknown>;
  switch (row.entityType) {
    case "resource":
      return `/resources/${row.id}`;
    case "subject":
      return `/subjects/${row.id}`;
    case "topic":
    case "book": {
      const subjectId = typeof meta.subjectId === "string" ? meta.subjectId : null;
      return subjectId ? `/subjects/${subjectId}` : "/resources";
    }
    case "semester":
      return `/semesters/${row.id}`;
    case "notice":
      return "/notices";
    default:
      return "/resources";
  }
}

export default function Search() {
  const [query, updateQuery] = useSearchQuery();
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [pagination, setPagination] = useState<SearchPagination | null>(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestId = useRef(0);
  const loadMoreController = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    setPage(1);
    setLoadingMore(false);
    // A new query supersedes any in-flight load-more as well.
    loadMoreController.current?.abort();
    loadMoreController.current = null;
    if (!q) {
      requestId.current += 1;
      setResults([]);
      setPagination(null);
      setError("");
      setState("idle");
      return;
    }
    const id = ++requestId.current;
    setState("loading");
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchContent({ q, limit: 20, signal: controller.signal }).then(
        (res) => {
          if (requestId.current !== id) return;
          setResults(res.data);
          setPagination(res.pagination);
          setState("ready");
        },
        (err: unknown) => {
          if (requestId.current !== id) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof SearchError ? err.message : "Search failed. Please try again.");
          setState("error");
        },
      );
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      // Unmount cancels everything, including load-more.
      loadMoreController.current?.abort();
      loadMoreController.current = null;
    };
    // retryNonce re-runs a failed query without changing the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, retryNonce]);

  const groups = useMemo(() => {
    const byEntity = new Map<string, SearchResultRow[]>();
    for (const row of results) {
      const list = byEntity.get(row.entityType);
      if (list) list.push(row);
      else byEntity.set(row.entityType, [row]);
    }
    const ordered: Array<{ entity: string; title: string; rows: SearchResultRow[] }> = [];
    for (const entity of GROUP_ORDER) {
      const rows = byEntity.get(entity);
      if (rows) ordered.push({ entity, title: GROUP_TITLES[entity], rows });
    }
    return ordered;
  }, [results]);

  const handleLoadMore = () => {
    const q = query.trim();
    if (!q || !pagination || loadingMore) return;
    const next = page + 1;
    if (next > pagination.pages) return;
    setLoadingMore(true);
    const id = ++requestId.current;
    const controller = new AbortController();
    loadMoreController.current = controller;
    searchContent({ q, limit: pagination.limit, page: next, signal: controller.signal }).then(
      (res) => {
        if (requestId.current !== id) return;
        setResults((prev) => [...prev, ...res.data]);
        setPagination(res.pagination);
        setPage(next);
        setLoadingMore(false);
      },
      (err: unknown) => {
        if (requestId.current !== id) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          setLoadingMore(false);
          return;
        }
        setError(err instanceof SearchError ? err.message : "Search failed. Please try again.");
        setState("error");
        setLoadingMore(false);
      },
    );
  };

  return (
    <div>
      <PageHeader title="Search" subtitle="Search across subjects, resources, topics, books, and notices." />
      <div className="mb-5">
        <SearchBar
          initialValue={query}
          placeholder="Search notes, subjects, past questions…"
          onSubmit={updateQuery}
        />
      </div>

      {state === "idle" && (
        <EmptyState
          title="Search the library"
          message="Type above to search semesters, subjects, topics, resources, books, and notices."
        />
      )}

      {state === "loading" && <SkeletonCards />}

      {state === "error" && (
        <EmptyState
          title="Search failed"
          message={error || "Search failed. Please try again."}
          actionLabel="Try again"
          onAction={() => setRetryNonce((n) => n + 1)}
        />
      )}

      {state === "ready" &&
        (results.length === 0 ? (
          <EmptyState title="No results" message={`Nothing matched "${query.trim()}". Try different keywords.`} />
        ) : (
          <div className="space-y-7">
            <p className="text-sm font-medium text-muted-foreground" role="status">
              {pagination?.total} result{pagination && pagination.total === 1 ? "" : "s"} for “{query.trim()}”
            </p>
            {groups.map((group) => (
              <section key={group.entity} aria-label={group.title}>
                <h2 className="mb-3 text-base font-bold text-foreground">{group.title}</h2>
                <Card className="divide-y divide-border p-0">
                  {group.rows.map((row) => {
                    const meta = metaLine(row);
                    return (
                      <Link
                        key={`${row.entityType}-${row.id}`}
                        to={destinationFor(row)}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <GroupIcon entityType={row.entityType} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-bold text-foreground">{row.title}</p>
                          {row.description && (
                            <p className="line-clamp-1 text-xs font-medium text-muted-foreground">{row.description}</p>
                          )}
                          {meta && (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground/80">
                              {meta}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </Card>
              </section>
            ))}
            {pagination && page < pagination.pages && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex h-10 items-center rounded-lg bg-primary-muted px-5 text-sm font-bold text-primary transition-colors hover:bg-primary-muted-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : `Show more (${pagination.total - results.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
