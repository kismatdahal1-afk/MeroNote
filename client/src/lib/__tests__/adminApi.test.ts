import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { adminCreate, adminGet, adminList, adminUpdate, adminUploadFile } from "../adminApi";

/**
 * Admin semester rendering regression: the admin API returns Mongoose lean
 * docs (`_id`, no `id` virtual) while admin pages join on string `id`
 * (semester sections, subject filters, React keys, create flows).
 * adminList/adminGet/adminCreate/adminUpdate must normalize `_id` → `id`
 * and stringify reference fields, preserving the existing
 * envelope/pagination behavior.
 */

function mockFetchSequence(bodies: unknown[]): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      urls.push(String(url));
      const body = bodies[Math.min(urls.length - 1, bodies.length - 1)];
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
  return urls;
}

function mockFetchOnce(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => body }) as Response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Mutating calls attach the double-submit CSRF proof (F3). In production the
// readable cookie always exists post-login; mirror that here so no bootstrap
// request consumes the mocked response sequences below.
beforeEach(() => {
  vi.stubGlobal("document", { cookie: `meronote_csrf=${"b".repeat(64)}` });
});

describe("adminApi id normalization", () => {
  it("maps lean semester rows (_id → id) and preserves pagination", async () => {
    const lean = [
      { _id: "64f000000000000000000001", number: 1, name: "Semester 1", order: 1, credits: 15, status: "published" },
      { _id: "64f000000000000000000002", number: 2, name: "Semester 2", order: 2, credits: 15, status: "published" },
    ];
    mockFetchOnce({ status: "ok", data: lean, pagination: { page: 1, limit: 100, total: 2, pages: 1 } });
    const { rows, total, pages } = await adminList<Record<string, unknown>>("semesters", { limit: 100 });
    expect(total).toBe(2);
    expect(pages).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("64f000000000000000000001");
    expect(rows[1].id).toBe("64f000000000000000000002");
    expect(rows[0]).not.toHaveProperty("_id");
    // Untouched fields survive.
    expect(rows[0].name).toBe("Semester 1");
    expect(rows[0].order).toBe(1);
  });

  it("stringifies reference ids (semesterId/subjectId/topicId) on rows", async () => {
    const lean = [
      { _id: "64f000000000000000000010", semesterId: "64f000000000000000000001", name: "Sub", code: "X101" },
    ];
    mockFetchOnce({ status: "ok", data: lean, pagination: { page: 1, limit: 100, total: 1, pages: 1 } });
    const { rows } = await adminList<Record<string, unknown>>("subjects", { limit: 100 });
    expect(rows[0].id).toBe("64f000000000000000000010");
    expect(rows[0].semesterId).toBe("64f000000000000000000001");
  });

  it("normalizes adminGet detail docs the same way", async () => {
    mockFetchOnce({
      status: "ok",
      data: { _id: "64f000000000000000000001", number: 1, name: "Semester 1", order: 1 },
    });
    const doc = await adminGet<Record<string, unknown>>("semesters", "64f000000000000000000001");
    expect(doc.id).toBe("64f000000000000000000001");
    expect(doc).not.toHaveProperty("_id");
  });

  it("leaves already-normalized rows (id, no _id) untouched", async () => {
    mockFetchOnce({
      status: "ok",
      data: [{ id: "abc", name: "Semester 1" }],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });
    const { rows } = await adminList<Record<string, unknown>>("semesters", { limit: 100 });
    expect(rows[0].id).toBe("abc");
  });

  it("normalizes adminCreate/adminUpdate returns (_id → id)", async () => {
    mockFetchOnce({ status: "ok", data: { _id: "64f000000000000000000020", title: "R", semesterId: "64f000000000000000000001" } });
    const created = await adminCreate<Record<string, unknown>>("resources", { title: "R" });
    expect(created.id).toBe("64f000000000000000000020");
    expect(created).not.toHaveProperty("_id");
    expect(created.semesterId).toBe("64f000000000000000000001");

    mockFetchOnce({ status: "ok", data: { _id: "64f000000000000000000020", title: "R2" } });
    const updated = await adminUpdate<Record<string, unknown>>("resources", "64f000000000000000000020", { title: "R2" });
    expect(updated.id).toBe("64f000000000000000000020");
  });

  it("create-then-upload uses the real Mongo id (invalid-ID regression)", async () => {
    // Exact failing Admin UI flow: ResourceEditorModal creates a resource,
    // then uploads the PDF to /api/admin/resources/:id/file. Before the fix,
    // `created.id` was undefined (raw `_id` doc) and the upload hit
    // `/undefined/file` → 400 "Invalid resource id."
    const urls = mockFetchSequence([
      { status: "ok", data: { _id: "64f000000000000000000030", title: "New" } },
      { status: "ok", data: { fileName: "new.pdf", fileSize: 48 } },
    ]);
    const created = await adminCreate<{ id: string }>("resources", { title: "New" });
    expect(created.id).toBe("64f000000000000000000030");
    await adminUploadFile(created.id, new File(["%PDF-1.4"], "new.pdf", { type: "application/pdf" }));
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("/api/admin/resources/64f000000000000000000030/file");
    expect(urls[1]).not.toContain("undefined");
  });
});
