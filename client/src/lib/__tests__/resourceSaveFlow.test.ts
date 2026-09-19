import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { executeResourceSave, planResourceSave } from "../resourceSaveFlow";

/**
 * Upload-timing regression: selecting a PDF must never upload; only an
 * explicit Save publishes, and publication happens strictly after a
 * successful upload + metadata persistence.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const MODAL_PATH = join(HERE, "..", "..", "components", "admin", "ResourceEditorModal.tsx");

function mockDeps(outcome: { upload?: "ok" | "fail"; publish?: "ok" | "fail" } = {}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      create: vi.fn(async (body: Record<string, unknown>) => {
        calls.push(`create:${String(body.status)}`);
        return { id: "res-1" };
      }),
      update: vi.fn(async (id: string, body: Record<string, unknown>) => {
        calls.push(`update:${id}:${JSON.stringify(body)}`);
        if (body.status === "published" && outcome.publish === "fail") throw new Error("publish boom");
      }),
      upload: vi.fn(async (id: string) => {
        calls.push(`upload:${id}`);
        if (outcome.upload === "fail") throw new Error("B2 boom");
      }),
    },
  };
}

const PAYLOAD = { title: "T", semesterId: "sem-1", subjectId: "sub-1" };
const FILE = new File(["%PDF-1.4"], "t.pdf", { type: "application/pdf" });

describe("planResourceSave", () => {
  it("stages publish+pending-file (new) as draft with publish-after-upload", () => {
    expect(planResourceSave({ status: "published", hasPendingFile: true, hasStoredFile: false, isNew: true }))
      .toEqual({ stagedStatus: "draft", publishAfterUpload: true });
  });
  it("stages publish+pending-file on fileless edit as draft", () => {
    expect(planResourceSave({ status: "published", hasPendingFile: true, hasStoredFile: false, isNew: false }))
      .toEqual({ stagedStatus: "draft", publishAfterUpload: true });
  });
  it("does not stage replacement on published resource that has a file", () => {
    expect(planResourceSave({ status: "published", hasPendingFile: true, hasStoredFile: true, isNew: false }))
      .toEqual({ stagedStatus: "published", publishAfterUpload: false });
  });
  it("blocks publish with neither pending nor stored file", () => {
    const plan = planResourceSave({ status: "published", hasPendingFile: false, hasStoredFile: false, isNew: false });
    expect(plan.blocked).toMatch(/before publishing/);
  });
  it("allows publish with stored file and no pending file", () => {
    expect(planResourceSave({ status: "published", hasPendingFile: false, hasStoredFile: true, isNew: false }))
      .toEqual({ stagedStatus: "published", publishAfterUpload: false });
  });
  it("draft save never stages nor publishes after", () => {
    expect(planResourceSave({ status: "draft", hasPendingFile: true, hasStoredFile: false, isNew: true }))
      .toEqual({ stagedStatus: "draft", publishAfterUpload: false });
  });
});

describe("executeResourceSave", () => {
  it("Save & Publish (new): create draft → upload → publish, in order", async () => {
    const { calls, deps } = mockDeps();
    const result = await executeResourceSave(deps, {
      isNew: true, payload: PAYLOAD, status: "published", file: FILE, pageCount: 3, hasStoredFile: false,
    });
    expect(result).toEqual({ ok: true, resourceId: "res-1", published: true });
    expect(calls).toEqual(["create:draft", "upload:res-1", 'update:res-1:{"status":"published"}']);
  });

  it("upload failure prevents publication (stays draft)", async () => {
    const { calls, deps } = mockDeps({ upload: "fail" });
    const result = await executeResourceSave(deps, {
      isNew: true, payload: PAYLOAD, status: "published", file: FILE, pageCount: 3, hasStoredFile: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("upload-failed");
    expect(calls).toEqual(["create:draft", "upload:res-1"]);
    expect(calls.some((c) => c.includes('"published"'))).toBe(false);
  });

  it("draft save uploads without ever publishing", async () => {
    const { calls, deps } = mockDeps();
    const result = await executeResourceSave(deps, {
      isNew: true, payload: PAYLOAD, status: "draft", file: FILE, pageCount: 3, hasStoredFile: false,
    });
    expect(result).toEqual({ ok: true, resourceId: "res-1", published: false });
    expect(calls).toEqual(["create:draft", "upload:res-1"]);
  });

  it("publish without any file is blocked before any network call", async () => {
    const { calls, deps } = mockDeps();
    const result = await executeResourceSave(deps, {
      isNew: false, editingId: "res-9", payload: PAYLOAD, status: "published", file: null, hasStoredFile: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blocked-no-file");
    expect(calls).toEqual([]);
  });

  it("replacement on published resource with stored file: no staging, failed upload issues no further writes", async () => {
    const { calls, deps } = mockDeps({ upload: "fail" });
    const result = await executeResourceSave(deps, {
      isNew: false, editingId: "res-1", payload: PAYLOAD, status: "published", file: FILE, pageCount: 3, hasStoredFile: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("upload-failed");
    // Metadata update ran as published (old file stays live server-side);
    // nothing else ran after the failed upload.
    expect(calls[0].startsWith("update:res-1:")).toBe(true);
    expect(calls).toEqual([calls[0], "upload:res-1"]);
  });

  it("publish-step failure keeps a valid draft+file (no publish)", async () => {
    const { calls, deps } = mockDeps({ publish: "fail" });
    const result = await executeResourceSave(deps, {
      isNew: true, payload: PAYLOAD, status: "published", file: FILE, pageCount: 3, hasStoredFile: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("publish-failed");
      expect(result.resourceId).toBe("res-1");
    }
    expect(calls).toEqual(["create:draft", "upload:res-1", 'update:res-1:{"status":"published"}']);
  });
});

describe("editor wiring (no upload on file selection)", () => {
  it("acceptFile stores the file locally without calling any upload API", () => {
    const text = readFileSync(MODAL_PATH, "utf8");
    const acceptBlock = text.slice(text.indexOf("const acceptFile"), text.indexOf("const save"));
    expect(acceptBlock).toContain("setFile");
    expect(acceptBlock).not.toMatch(/adminUploadFile|uploadResourceFile|fetch\(|axios/);
  });

  it("save path stages publication through the shared flow", () => {
    const text = readFileSync(MODAL_PATH, "utf8");
    expect(text).toContain("executeResourceSave");
  });
});
