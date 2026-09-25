import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SemesterPlanApiError,
  getSemesterPlan,
  isObjectIdLike,
  isPlanStatus,
  isValidCalendarDate,
  isValidDatePair,
  mergePlanRowsToState,
  mirrorKeyFor,
  selectMigrationPayload,
  updateSemesterPlan,
  type SemesterPlanRow,
} from "../semesterPlanApi";

/**
 * Phase 16 semester-plan client verification.
 * Pure helpers + API contract with mocked fetch. No network, no MongoDB.
 */

const ROW = (over: Partial<SemesterPlanRow> = {}): SemesterPlanRow => ({
  _id: "000000000000000000000001",
  userId: "0000000000000000000000a1",
  semesterId: "000000000000000000000011",
  status: "ongoing",
  createdAt: new Date("2026-09-01T00:00:00.000Z").toISOString(),
  updatedAt: new Date("2026-09-02T00:00:00.000Z").toISOString(),
  ...over,
});

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", (url: unknown, init?: RequestInit) => handler(String(url), init));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("calendar dates", () => {
  it("accepts valid yyyy-mm-dd", () => {
    expect(isValidCalendarDate("2026-09-01")).toBe(true);
    expect(isValidCalendarDate("2027-01-15")).toBe(true);
  });

  it("rejects wrong formats and impossible dates (timezone-safe)", () => {
    expect(isValidCalendarDate("09/01/2026")).toBe(false);
    expect(isValidCalendarDate("2026-9-1")).toBe(false);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
    expect(isValidCalendarDate(null)).toBe(false);
    expect(isValidCalendarDate(undefined)).toBe(false);
  });

  it("rejects non-plan statuses", () => {
    expect(isPlanStatus("ongoing")).toBe(true);
    expect(isPlanStatus("upcoming")).toBe(true);
    expect(isPlanStatus("passed")).toBe(true);
    expect(isPlanStatus("active")).toBe(false);
    expect(isPlanStatus("")).toBe(false);
  });

  it("re-exports the shared ObjectId guard", () => {
    expect(isObjectIdLike("aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(isObjectIdLike("not-an-id")).toBe(false);
  });
});

describe("date pairs", () => {
  it("accepts valid pairs with end strictly after start", () => {
    expect(isValidDatePair("2026-09-01", "2027-01-15")).toBe(true);
  });

  it("rejects equal, inverted, malformed, or partial pairs", () => {
    expect(isValidDatePair("2026-09-01", "2026-09-01")).toBe(false);
    expect(isValidDatePair("2027-01-15", "2026-09-01")).toBe(false);
    expect(isValidDatePair("09/01/2026", "2027-01-15")).toBe(false);
    expect(isValidDatePair("2026-09-01", undefined)).toBe(false);
    expect(isValidDatePair(undefined, "2027-01-15")).toBe(false);
    expect(isValidDatePair("2026-02-30", "2027-01-15")).toBe(false);
  });
});

describe("mirror keys are user-scoped", () => {
  it("namespaces authed mirrors per user", () => {
    const a = mirrorKeyFor("0000000000000000000000a1");
    const b = mirrorKeyFor("0000000000000000000000b2");
    expect(a).toContain("0000000000000000000000a1");
    expect(b).toContain("0000000000000000000000b2");
    expect(a).not.toBe(b);
  });

  it("keeps guests on the legacy device key", () => {
    expect(mirrorKeyFor(null)).toBe("meronote-semester-enrollment");
  });
});

describe("mergePlanRowsToState (server wins)", () => {
  it("merges valid rows with dates", () => {
    const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const next = mergePlanRowsToState([
      ROW({ semesterId: id, status: "ongoing", startDate: "2026-09-01", endDate: "2027-01-15" }),
    ]);
    expect(next.statuses[id]).toBe("ongoing");
    expect(next.dates[id]).toEqual({ startDate: "2026-09-01", endDate: "2027-01-15" });
  });

  it("drops invalid ids, statuses, and bad date pairs", () => {
    const good = "bbbbbbbbbbbbbbbbbbbbbbbb";
    const next = mergePlanRowsToState([
      ROW({ semesterId: "not-an-id", status: "ongoing" }),
      ROW({ semesterId: good, status: "active" as never }),
      ROW({ semesterId: good, status: "upcoming", startDate: "2027-01-15", endDate: "2026-09-01" }),
      ROW({ semesterId: good, status: "upcoming" }),
    ]);
    expect(next.statuses).toEqual({ [good]: "upcoming" });
    expect(next.dates[good]).toBeUndefined();
  });
});

describe("selectMigrationPayload", () => {
  it("migrates eligible local state and skips junk", () => {
    const good = "cccccccccccccccccccccccc";
    const payload = selectMigrationPayload(
      { [good]: "ongoing", junk: "ongoing", [good + "x"]: "ongoing" } as Record<string, string>,
      { [good]: { startDate: "2026-09-01", endDate: "2027-01-15" } },
    );
    expect(payload).toEqual([{ semesterId: good, status: "ongoing", startDate: "2026-09-01", endDate: "2027-01-15" }]);
  });

  it("migrates status-only when dates are invalid", () => {
    const good = "dddddddddddddddddddddddd";
    const payload = selectMigrationPayload({ [good]: "passed" }, { [good]: { startDate: "bad", endDate: "bad" } });
    expect(payload).toEqual([{ semesterId: good, status: "passed" }]);
  });

  it("skips unknown statuses", () => {
    const good = "eeeeeeeeeeeeeeeeeeeeeeee";
    expect(selectMigrationPayload({ [good]: "active" }, {})).toEqual([]);
  });
});

describe("getSemesterPlan", () => {
  it("hydrates rows from the API envelope", async () => {
    const rows = [ROW()];
    mockFetchOnce(() => Response.json({ status: "ok", data: rows }));
    await expect(getSemesterPlan()).resolves.toEqual(rows);
  });

  it("returns null on 401 without throwing (guest fallback)", async () => {
    mockFetchOnce(() => new Response("{}", { status: 401 }));
    await expect(getSemesterPlan()).resolves.toBeNull();
  });

  it("sends credentials:include", async () => {
    let seen: RequestInit | undefined;
    mockFetchOnce((_url, init) => {
      seen = init;
      return Response.json({ status: "ok", data: [] });
    });
    await getSemesterPlan();
    expect((seen as RequestInit)?.credentials).toBe("include");
  });
});

describe("updateSemesterPlan", () => {
  it("PATCHes status and returns the saved row", async () => {
    const id = "ffffffffffffffffffffffff";
    let seenUrl = "";
    let seenBody = "";
    mockFetchOnce((url, init) => {
      seenUrl = url;
      seenBody = String(init?.body ?? "");
      return Response.json({ status: "ok", data: ROW({ semesterId: id, status: "ongoing" }) });
    });
    const row = await updateSemesterPlan(id, { status: "ongoing" });
    expect(seenUrl).toContain(`/api/me/semester-plan/${id}`);
    expect(JSON.parse(seenBody)).toEqual({ status: "ongoing" });
    expect(row.status).toBe("ongoing");
  });

  it("PATCHes dates without requiring status", async () => {
    let seenBody = "";
    mockFetchOnce((_url, init) => {
      seenBody = String(init?.body ?? "");
      return Response.json({ status: "ok", data: ROW() });
    });
    await updateSemesterPlan("ffffffffffffffffffffffff", { startDate: "2026-09-01", endDate: "2027-01-15" });
    expect(JSON.parse(seenBody)).toEqual({ startDate: "2026-09-01", endDate: "2027-01-15" });
  });

  it("throws with the server message on validation failure (no false success)", async () => {
    mockFetchOnce(() => Response.json({ status: "error", message: "Field 'endDate' must be after 'startDate'." }, { status: 400 }));
    const err = await updateSemesterPlan("ffffffffffffffffffffffff", {
      startDate: "2027-01-15",
      endDate: "2026-09-01",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SemesterPlanApiError);
    expect((err as SemesterPlanApiError).status).toBe(400);
    expect((err as SemesterPlanApiError).message).toContain("after 'startDate'");
  });

  it("throws status 0 when the server is unreachable", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("down")));
    const err = await updateSemesterPlan("ffffffffffffffffffffffff", { status: "ongoing" }).catch((e) => e);
    expect(err).toBeInstanceOf(SemesterPlanApiError);
    expect((err as SemesterPlanApiError).status).toBe(0);
  });
});
