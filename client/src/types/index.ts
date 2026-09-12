export type ResourceType =
  | "book"
  | "short_note"
  | "extra_note"
  | "questions"
  | "past_paper"
  | "important_questions"
  | "practical"
  | "revision_note"
  | "other";

export interface Semester {
  id: string;
  number: number;
  name: string;
  description: string;
  subjectCount: number;
  resourceCount: number;
}

export interface Subject {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  description: string;
  category: "core" | "elective" | "practical";
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  semesterId: string;
  subjectId: string;
  type: ResourceType;
  fileName: string;
  fileSize: number;
  pageCount: number;
  tags: string[];
  uploadedAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  resourceId: string;
  lastPage: number;
  /** 0..1 */
  progress: number;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  resourceId: string;
  page: number;
  note: string;
  createdAt: string;
}

export interface DownloadItem {
  id: string;
  resourceId: string;
  status: "queued" | "downloading" | "completed" | "failed";
  /** 0..100 */
  progress: number;
  sizeBytes: number;
  downloadedAt: string;
}

export interface RecentEntry {
  resourceId: string;
  openedAt: string;
}

export interface MockUser {
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}
