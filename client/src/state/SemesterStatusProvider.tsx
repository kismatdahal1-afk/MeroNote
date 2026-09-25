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
import type { SemesterUserStatus } from "../types";
import { useUser } from "./UserProvider";
import { useToast } from "./ToastProvider";
import {
  getSemesterPlan,
  isObjectIdLike,
  isPlanStatus,
  isValidCalendarDate,
  isValidDatePair,
  mergePlanRowsToState,
  mirrorKeyFor,
  selectMigrationPayload,
  updateSemesterPlan,
} from "../lib/semesterPlanApi";

/**
 * Semester enrollment state (Phase 16: server-authoritative for
 * authenticated users, device-local mirror otherwise).
 *
 * - Guests keep the legacy device-only behavior (`meronote-semester-enrollment`).
 * - Authenticated users hydrate from GET /api/me/semester-plan; the server
 *   is the source of truth and every change PATCHes MongoDB (user_semester_plans).
 * - A per-user local mirror (`meronote-semester-enrollment.v2.<userId>`) keeps
 *   offline fallback and never leaks across users.
 * - One-time migration copies eligible legacy device state to the server when
 *   the server plan is absent; existing server state always wins. Claimed
 *   legacy keys are removed after a server-confirmed migration so they can
 *   never be re-migrated into a different user's account on a shared device.
 * - In-flight saves are dropped after logout/user-switch so one user's plan
 *   never leaks into another user's UI or device mirror.
 * - Term progress stays derived via lib/semesterProgress — never stored.
 */

const LEGACY_STORAGE_KEY = "meronote-semester-enrollment";
/** Legacy key from the previous status-only implementation. */
const LEGACY_STATUS_KEY = "meronote-semester-statuses";

export interface SemesterTermDates {
  startDate: string;
  endDate: string;
}

type SemesterStatuses = Record<string, SemesterUserStatus>;
type SemesterDates = Record<string, SemesterTermDates>;

interface SemesterStatusContextValue {
  /** User-chosen status per semester id. */
  semesterStatuses: SemesterStatuses;
  /** Effective status: "ongoing" renders as "Active" in the UI. */
  getStatus: (semesterId: string) => SemesterUserStatus;
  setStatus: (semesterId: string, status: SemesterUserStatus) => void;
  /** Term dates for a semester (only meaningful while ongoing). */
  getDates: (semesterId: string) => SemesterTermDates | undefined;
  setDates: (semesterId: string, dates: SemesterTermDates) => void;
  /** The single semester currently marked "ongoing". */
  ongoingSemesterId: string | undefined;
  /** True while the account plan is being hydrated. */
  isPlanLoading: boolean;
  /** Last hydration/persistence failure, if any. */
  planError: string | null;
  /** Retry the last failed hydration. */
  retryPlan: () => void;
}

const SemesterStatusContext = createContext<SemesterStatusContextValue | null>(null);

function isSemesterId(id: string): boolean {
  return typeof id === "string" && id.trim().length > 0;
}

function readLegacyStatuses(): SemesterStatuses {
  const out: SemesterStatuses = {};
  if (typeof window === "undefined") return out;
  for (const key of [LEGACY_STORAGE_KEY, LEGACY_STATUS_KEY]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const record =
        parsed && typeof parsed === "object" && "statuses" in (parsed as Record<string, unknown>)
          ? (parsed as { statuses: unknown }).statuses
          : parsed;
      if (record && typeof record === "object") {
        for (const [id, value] of Object.entries(record as Record<string, unknown>)) {
          if (isPlanStatus(value) && isSemesterId(id)) {
            out[id] = value;
          }
        }
      }
    } catch {
      // Corrupt storage entry — skip it.
    }
  }
  return out;
}

function readLegacyDates(): SemesterDates {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const dates = (parsed as { dates?: unknown }).dates;
    if (!dates || typeof dates !== "object") return {};
    const out: SemesterDates = {};
    for (const [id, value] of Object.entries(dates as Record<string, unknown>)) {
      if (value && typeof value === "object" && isSemesterId(id)) {
        const { startDate, endDate } = value as { startDate?: unknown; endDate?: unknown };
        if (isValidCalendarDate(startDate) && isValidCalendarDate(endDate)) {
          out[id] = { startDate, endDate };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

function readMirror(userId: string): { statuses: SemesterStatuses; dates: SemesterDates } {
  const out: { statuses: SemesterStatuses; dates: SemesterDates } = { statuses: {}, dates: {} };
  if (typeof window === "undefined" || !userId) return out;
  try {
    const raw = window.localStorage.getItem(mirrorKeyFor(userId));
    if (!raw) return out;
    const parsed = JSON.parse(raw) as { statuses?: unknown; dates?: unknown };
    if (parsed && typeof parsed === "object") {
      if (parsed.statuses && typeof parsed.statuses === "object") {
        for (const [id, value] of Object.entries(parsed.statuses as Record<string, unknown>)) {
          if (isPlanStatus(value) && isSemesterId(id)) out.statuses[id] = value;
        }
      }
      if (parsed.dates && typeof parsed.dates === "object") {
        for (const [id, value] of Object.entries(parsed.dates as Record<string, unknown>)) {
          if (value && typeof value === "object" && isSemesterId(id)) {
            const { startDate, endDate } = value as { startDate?: unknown; endDate?: unknown };
            if (isValidCalendarDate(startDate) && isValidCalendarDate(endDate)) {
              out.dates[id] = { startDate, endDate };
            }
          }
        }
      }
    }
  } catch {
    // Corrupt mirror — treat as empty; server remains the source of truth.
  }
  return out;
}

function writeMirror(userId: string | null, statuses: SemesterStatuses, dates: SemesterDates): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(mirrorKeyFor(userId), JSON.stringify({ statuses, dates }));
  } catch {
    // Storage unavailable (private mode etc.) — keep UI-only state.
  }
}

/** No server seed — first run starts empty; UI defaults to upcoming. */
function seedDefaultStatuses(): SemesterStatuses {
  return {};
}

export function SemesterStatusProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useUser();
  const { toast } = useToast();
  const userId = authStatus === "authed" ? (user?.id ?? null) : null;

  const [semesterStatuses, setSemesterStatuses] = useState<SemesterStatuses>(() => {
    const stored = readLegacyStatuses();
    return Object.keys(stored).length > 0 ? stored : seedDefaultStatuses();
  });
  const [semesterDates, setSemesterDates] = useState<SemesterDates>(readLegacyDates);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const migratedRef = useRef<Set<string>>(new Set());

  const statusRef = useRef(semesterStatuses);
  const datesRef = useRef(semesterDates);
  statusRef.current = semesterStatuses;
  datesRef.current = semesterDates;
  // Identity of the currently authenticated user for guarding in-flight
  // saves: a response (or revert) must never be applied after logout or a
  // user switch, or one user's plan would leak into another user's UI and
  // device mirror.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  /* Hydration + one-time migration for authenticated users. */
  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus !== "authed" || !userId) {
      // Guest: device-only legacy state; never leave another user's plan active.
      setSemesterStatuses(readLegacyStatuses());
      setSemesterDates(readLegacyDates());
      setHydratedFor("guest");
      setPlanLoading(false);
      setPlanError(null);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    setPlanError(null);

    void (async () => {
      const rows = await getSemesterPlan();
      if (cancelled) return;

      if (rows && rows.length > 0) {
        // Server state wins over any local mirror.
        const next = mergePlanRowsToState(rows);
        setSemesterStatuses(next.statuses);
        setSemesterDates(next.dates);
        writeMirror(userId, next.statuses, next.dates);
        migratedRef.current.add(userId);
        setHydratedFor(userId);
        setPlanLoading(false);
        return;
      }

      if (rows && rows.length === 0 && !migratedRef.current.has(userId)) {
        migratedRef.current.add(userId);
        // Migrate eligible local state (own mirror first, legacy device state otherwise).
        const mirror = readMirror(userId);
        const hasMirror = Object.keys(mirror.statuses).length > 0;
        const sourceStatuses = hasMirror ? mirror.statuses : readLegacyStatuses();
        const sourceDates = hasMirror ? mirror.dates : readLegacyDates();
        const payload = selectMigrationPayload(sourceStatuses, sourceDates);
        let migrated = 0;
        for (const entry of payload) {
          if (cancelled) return;
          try {
            const { semesterId, ...update } = entry;
            await updateSemesterPlan(semesterId, update);
            migrated += 1;
          } catch {
            // Best-effort per semester — keep the rest migrating.
          }
        }
        if (cancelled) return;
        if (migrated > 0) {
          const refreshed = await getSemesterPlan();
          if (cancelled) return;
          if (refreshed && refreshed.length > 0) {
            const next = mergePlanRowsToState(refreshed);
            setSemesterStatuses(next.statuses);
            setSemesterDates(next.dates);
            writeMirror(userId, next.statuses, next.dates);
            // The device's unattributed legacy state is now claimed by this
            // account: drop it so a later fresh login by a different user on
            // this device cannot re-migrate it into their own plan. Guest
            // state created afterwards is written fresh by the guest branch.
            try {
              window.localStorage.removeItem(LEGACY_STORAGE_KEY);
              window.localStorage.removeItem(LEGACY_STATUS_KEY);
            } catch {
              // Storage unavailable — harmless; server remains authoritative.
            }
            setHydratedFor(userId);
            setPlanLoading(false);
            return;
          }
        }
        // Server empty (or migration had nothing eligible): start empty but
        // scoped to this user — never inherit another user's mirror.
        const empty: SemesterStatuses = {};
        setSemesterStatuses(empty);
        setSemesterDates({});
        writeMirror(userId, empty, {});
        setHydratedFor(userId);
        setPlanLoading(false);
        return;
      }

      if (rows) {
        // Already migrated and server still empty — stay empty for this user.
        setHydratedFor(userId);
        setPlanLoading(false);
        return;
      }

      // Hydration failed: fall back to this user's own mirror, never wipe to
      // defaults and never show another user's state.
      const mirror = readMirror(userId);
      if (Object.keys(mirror.statuses).length > 0) {
        setSemesterStatuses(mirror.statuses);
        setSemesterDates(mirror.dates);
        setHydratedFor(userId);
      }
      setPlanError("Could not load your semester plan. Showing the on-device copy.");
      setPlanLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setPlanError("Could not load your semester plan. Showing the on-device copy.");
        setPlanLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, userId, retryCount]);

  /* Mirror writes: namespaced per user once hydrated; legacy key for guests. */
  useEffect(() => {
    if (authStatus === "loading" || hydratedFor === null) return;
    if (authStatus === "authed" && userId) {
      if (hydratedFor !== userId) return;
      writeMirror(userId, semesterStatuses, semesterDates);
    } else if (hydratedFor === "guest") {
      try {
        window.localStorage.setItem(
          LEGACY_STORAGE_KEY,
          JSON.stringify({ statuses: semesterStatuses, dates: semesterDates }),
        );
        // Remove the superseded legacy entry once migrated.
        window.localStorage.removeItem(LEGACY_STATUS_KEY);
      } catch {
        // Storage unavailable (private mode etc.) — keep UI-only state.
      }
    }
  }, [semesterStatuses, semesterDates, hydratedFor, authStatus, userId]);

  const setStatus = useCallback(
    (semesterId: string, status: SemesterUserStatus) => {
      if (!isSemesterId(semesterId) || !isPlanStatus(status)) return;
      const actor = userId;
      const snapshot = { statuses: statusRef.current, dates: datesRef.current };
      setSemesterStatuses((prev) => {
        const next = { ...prev, [semesterId]: status };
        // Only one semester can be "ongoing" at a time; keep its dates.
        if (status === "ongoing") {
          for (const id of Object.keys(next)) {
            if (id !== semesterId && next[id] === "ongoing") next[id] = "upcoming";
          }
        }
        return next;
      });
      if (authStatus === "authed" && actor && isObjectIdLike(semesterId)) {
        updateSemesterPlan(semesterId, { status }).then(
          (row) => {
            // Drop late responses after logout/user-switch: the server row
            // belongs to the actor, but this device now shows someone else
            // (or a guest) — applying it would leak across users.
            if (actor !== userIdRef.current) return;
            setSemesterStatuses((prev) => ({ ...prev, [row.semesterId]: row.status }));
            if (isValidCalendarDate(row.startDate) && isValidCalendarDate(row.endDate)) {
              const startDate = row.startDate;
              const endDate = row.endDate;
              setSemesterDates((prev) => ({ ...prev, [row.semesterId]: { startDate, endDate } }));
            }
          },
          () => {
            if (actor !== userIdRef.current) return;
            setSemesterStatuses(snapshot.statuses);
            setSemesterDates(snapshot.dates);
            try {
              toast("Could not save semester status. Please try again.", "error");
            } catch {
              // Toast unavailable — state was already restored.
            }
          },
        );
      }
    },
    [authStatus, userId, toast],
  );

  const setDates = useCallback(
    (semesterId: string, dates: SemesterTermDates) => {
      if (!isSemesterId(semesterId)) return;
      // Reject invalid pairs locally (same rule as the server) instead of
      // sending a doomed request that would revert + toast.
      if (!isValidDatePair(dates.startDate, dates.endDate)) return;
      const actor = userId;
      const snapshot = { statuses: statusRef.current, dates: datesRef.current };
      setSemesterDates((prev) => ({ ...prev, [semesterId]: dates }));
      if (authStatus === "authed" && actor && isObjectIdLike(semesterId)) {
        updateSemesterPlan(semesterId, { startDate: dates.startDate, endDate: dates.endDate }).then(
          (row) => {
            if (actor !== userIdRef.current) return;
            if (isValidCalendarDate(row.startDate) && isValidCalendarDate(row.endDate)) {
              const startDate = row.startDate;
              const endDate = row.endDate;
              setSemesterDates((prev) => ({ ...prev, [row.semesterId]: { startDate, endDate } }));
            }
            if (isPlanStatus(row.status)) {
              setSemesterStatuses((prev) => ({ ...prev, [row.semesterId]: row.status }));
            }
          },
          () => {
            if (actor !== userIdRef.current) return;
            setSemesterStatuses(snapshot.statuses);
            setSemesterDates(snapshot.dates);
            try {
              toast("Could not save semester dates. Please try again.", "error");
            } catch {
              // Toast unavailable — state was already restored.
            }
          },
        );
      }
    },
    [authStatus, userId, toast],
  );

  const getStatus = useCallback(
    (semesterId: string): SemesterUserStatus => semesterStatuses[semesterId] ?? "upcoming",
    [semesterStatuses],
  );

  const getDates = useCallback(
    (semesterId: string) => semesterDates[semesterId],
    [semesterDates],
  );

  const ongoingSemesterId = useMemo(
    () => Object.keys(semesterStatuses).find((id) => semesterStatuses[id] === "ongoing"),
    [semesterStatuses],
  );

  const retryPlan = useCallback(() => {
    setPlanError(null);
    setRetryCount((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      semesterStatuses,
      getStatus,
      setStatus,
      getDates,
      setDates,
      ongoingSemesterId,
      isPlanLoading: planLoading,
      planError,
      retryPlan,
    }),
    [semesterStatuses, getStatus, setStatus, getDates, setDates, ongoingSemesterId, planLoading, planError, retryPlan],
  );

  return (
    <SemesterStatusContext.Provider value={value}>
      {children}
    </SemesterStatusContext.Provider>
  );
}

export function useSemesterStatus(): SemesterStatusContextValue {
  const ctx = useContext(SemesterStatusContext);
  if (!ctx) throw new Error("useSemesterStatus must be used within SemesterStatusProvider");
  return ctx;
}
