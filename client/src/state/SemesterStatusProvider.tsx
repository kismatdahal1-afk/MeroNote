import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SemesterUserStatus } from "../types";

/**
 * Frontend-only, per-semester enrollment data chosen by the user (local-only
 * by design — no backend API; preserved through Phase 12):
 *  - status: upcoming | ongoing | passed
 *  - startDate / endDate: term dates, editable while the semester is "ongoing"
 *
 * Persisted to localStorage. Term progress (elapsed/remaining/percentage) is
 * derived from the dates via lib/semesterProgress — never stored or hardcoded.
 */

const STORAGE_KEY = "meronote-semester-enrollment";
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
}

const SemesterStatusContext = createContext<SemesterStatusContextValue | null>(null);

function isSemesterId(id: string): boolean {
  return typeof id === "string" && id.trim().length > 0;
}

function readStoredStatuses(): SemesterStatuses {
  const out: SemesterStatuses = {};
  if (typeof window === "undefined") return out;
  for (const key of [STORAGE_KEY, LEGACY_STATUS_KEY]) {
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
          if ((value === "passed" || value === "ongoing" || value === "upcoming") && isSemesterId(id)) {
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

function readStoredDates(): SemesterDates {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const dates = (parsed as { dates?: unknown }).dates;
    if (!dates || typeof dates !== "object") return {};
    const out: SemesterDates = {};
    for (const [id, value] of Object.entries(dates as Record<string, unknown>)) {
      if (value && typeof value === "object" && isSemesterId(id)) {
        const { startDate, endDate } = value as { startDate?: unknown; endDate?: unknown };
        if (typeof startDate === "string" && typeof endDate === "string") {
          out[id] = { startDate, endDate };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** No server seed — first run starts empty; UI defaults to upcoming. */
function seedDefaultStatuses(): SemesterStatuses {
  return {};
}

export function SemesterStatusProvider({ children }: { children: ReactNode }) {
  const [semesterStatuses, setSemesterStatuses] = useState<SemesterStatuses>(() => {
    const stored = readStoredStatuses();
    return Object.keys(stored).length > 0 ? stored : seedDefaultStatuses();
  });
  const [semesterDates, setSemesterDates] = useState<SemesterDates>(readStoredDates);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ statuses: semesterStatuses, dates: semesterDates }),
      );
      // Remove the superseded legacy entry once migrated.
      window.localStorage.removeItem(LEGACY_STATUS_KEY);
    } catch {
      // Storage unavailable (private mode etc.) — keep UI-only state.
    }
  }, [semesterStatuses, semesterDates]);

  const setStatus = useCallback((semesterId: string, status: SemesterUserStatus) => {
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
  }, []);

  const setDates = useCallback((semesterId: string, dates: SemesterTermDates) => {
    setSemesterDates((prev) => ({ ...prev, [semesterId]: dates }));
  }, []);

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

  const value = useMemo(
    () => ({
      semesterStatuses,
      getStatus,
      setStatus,
      getDates,
      setDates,
      ongoingSemesterId,
    }),
    [semesterStatuses, getStatus, setStatus, getDates, setDates, ongoingSemesterId],
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
