import { ReaderShell } from "../../components/reader/ReaderShell";

/**
 * Admin PDF reader — same shared ReaderShell as the student panel, with
 * back/details links kept inside the admin flow.
 */
export default function AdminReader() {
  return <ReaderShell admin />;
}
