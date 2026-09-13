import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getDb, subscribe, type CmsDb } from "./cmsStore";

/**
 * Bridges the imperative cmsStore into React: any mutation triggers a
 * version bump so every useCms() consumer re-renders with fresh data.
 * All reads go through data/selectors.ts (see its note) so the swap to a
 * real API later only touches this provider + the store.
 */

const CmsContext = createContext<{ version: number; db: CmsDb } | null>(null);

export function CmsProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState(() => getDb());

  useEffect(() => subscribe(() => setDb(getDb())), []);

  return <CmsContext.Provider value={{ version: 0, db }}>{children}</CmsContext.Provider>;
}

/** Live CMS database snapshot; re-renders on any mutation. */
export function useCms(): CmsDb {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error("useCms must be used within CmsProvider");
  return ctx.db;
}
