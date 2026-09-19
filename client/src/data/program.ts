import type { ProgramInfo } from "../types";

/**
 * Local-only program banner copy (Phase 12 intentionally retained).
 * No API source — the dashboard greeting banner is static branding.
 * Server seed scripts continue to use `data/mock` (dev-only); this module
 * keeps the student bundle free of the seed arrays.
 */
export const programInfo: ProgramInfo = {
  university: "Tribhuvan University",
  program: "BSc. CSIT",
  batch: "Batch '83",
  studentLabel: "TU CSIT Student",
  currentSemesterId: "sem-4",
  exam: {
    title: "TU Board Exam",
    scope: "Sem IV",
    date: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000).toISOString(),
  },
};
