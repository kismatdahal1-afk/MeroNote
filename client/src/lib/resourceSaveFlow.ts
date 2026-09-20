import type { Resource } from "../types";

/**
 * Resource save/publish orchestration (Admin Resource editor timing rules).
 *
 * Timing contract (verified against ResourceEditorModal + backend):
 * - Selecting a PDF NEVER uploads (the file input only keeps the File in
 *   local modal state; canceling the editor performs zero network calls).
 * - An explicit Save with a pending file uploads AFTER create/update and
 *   persists metadata via the existing upload endpoint (put-then-persist
 *   with compensating B2 cleanup lives server-side and is reused as-is).
 * - Save & Publish with a pending file on a resource that has NO stored
 *   file must NOT publish first: the record is staged as draft, the upload
 *   runs, and publication happens only after upload + metadata persistence
 *   succeed. Upload failure leaves a draft (never a published fileless
 *   resource, never a broken file reference).
 * - Replacing the file on an already-published resource that HAS a stored
 *   file keeps the old file live until the atomic backend swap; no staging
 *   is needed and a failed upload preserves the working file.
 * - Publish with neither pending nor stored file is blocked client-side.
 */

export type SaveStatus = Resource["status"];

export interface SavePlanInput {
  /** Requested status from the editor's status toggle. */
  status: SaveStatus;
  /** A PDF was selected in this editing session (local only, not uploaded). */
  hasPendingFile: boolean;
  /** The editing resource already carries stored file metadata. */
  hasStoredFile: boolean;
  /** True when creating (or staging a save-as-draft copy), false when updating. */
  isNew: boolean;
}

export interface SavePlan {
  /** Set when the save must not proceed (caller shows this on the file field). */
  blocked?: string;
  /** Status to write for the create/update step. */
  stagedStatus: SaveStatus;
  /** Flip to published via update only after a successful upload. */
  publishAfterUpload: boolean;
}

export function planResourceSave(input: SavePlanInput): SavePlan {
  const wantsPublish = input.status === "published";
  if (wantsPublish && !input.hasPendingFile && !input.hasStoredFile) {
    return { blocked: "Select a PDF before publishing.", stagedStatus: input.status, publishAfterUpload: false };
  }
  // Stage as draft only when publication would otherwise land on a record
  // with no stored file. An already-published file keeps serving the old
  // object until the backend's atomic swap completes.
  const stageAsDraft = wantsPublish && input.hasPendingFile && (input.isNew || !input.hasStoredFile);
  return {
    stagedStatus: stageAsDraft ? "draft" : input.status,
    publishAfterUpload: stageAsDraft,
  };
}

export interface SaveFlowDeps {
  create: (body: Record<string, unknown>) => Promise<{ id: string }>;
  update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  upload: (id: string, file: File, pageCount?: number) => Promise<unknown>;
}

export interface SaveFlowArgs {
  isNew: boolean;
  /** Existing resource id for updates (ignored when isNew). */
  editingId?: string;
  /** Save-as-draft copy of a non-draft resource (always creates). */
  saveAsNewDraft?: boolean;
  payload: Record<string, unknown>;
  status: SaveStatus;
  /** Locally selected file (never uploaded except through this flow). */
  file: File | null;
  pageCount?: number;
  hasStoredFile: boolean;
}

export type SaveFlowResult =
  | { ok: true; resourceId: string; published: boolean }
  | { ok: false; reason: "blocked-no-file" | "upload-failed" | "publish-failed"; resourceId?: string; message: string };

/**
 * Explicit-save workflow: create/update → upload pending file → publish iff
 * staged. Create/update errors propagate (caller toasts "Could not save").
 * Upload failure never publishes; publish failure keeps a valid draft+file.
 */
export async function executeResourceSave(deps: SaveFlowDeps, args: SaveFlowArgs): Promise<SaveFlowResult> {
  const _t0 = Date.now();
  console.log(`[TIMING] executeResourceSave START isNew=${args.isNew} hasFile=${args.file !== null} status=${args.status}`);
  const plan = planResourceSave({
    status: args.status,
    hasPendingFile: args.file !== null,
    hasStoredFile: args.hasStoredFile,
    isNew: args.isNew || args.saveAsNewDraft === true,
  });
  if (plan.blocked) {
    return { ok: false, reason: "blocked-no-file", message: plan.blocked };
  }
  const staged = { ...args.payload, status: plan.stagedStatus };
  let resourceId: string;
  if (args.isNew || args.saveAsNewDraft === true) {
    const t1 = Date.now();
    const created = await deps.create(staged);
    console.log(`[TIMING] executeResourceSave deps.create done in ${Date.now() - t1}ms (total ${Date.now() - _t0}ms) id=${created.id}`);
    resourceId = created.id;
  } else {
    resourceId = String(args.editingId ?? "");
    const t1 = Date.now();
    await deps.update(resourceId, staged);
    console.log(`[TIMING] executeResourceSave deps.update done in ${Date.now() - t1}ms (total ${Date.now() - _t0}ms)`);
  }
  if (args.file) {
    try {
      const t2 = Date.now();
      console.log(`[TIMING] executeResourceSave upload START at ${t2} (total ${Date.now() - _t0}ms) fileSize=${args.file.size}`);
      await deps.upload(resourceId, args.file, args.pageCount);
      console.log(`[TIMING] executeResourceSave upload done in ${Date.now() - t2}ms (total ${Date.now() - _t0}ms)`);
    } catch (err) {
      return {
        ok: false,
        reason: "upload-failed",
        resourceId,
        message: err instanceof Error ? err.message : "Upload failed.",
      };
    }
  }
  if (plan.publishAfterUpload) {
    try {
      const t3 = Date.now();
      await deps.update(resourceId, { status: "published" satisfies SaveStatus });
      console.log(`[TIMING] executeResourceSave publish done in ${Date.now() - t3}ms (total ${Date.now() - _t0}ms)`);
    } catch (err) {
      return {
        ok: false,
        reason: "publish-failed",
        resourceId,
        message: err instanceof Error ? err.message : "Publishing failed.",
      };
    }
    return { ok: true, resourceId, published: true };
  }
  return { ok: true, resourceId, published: args.status === "published" };
}
