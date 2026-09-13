import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mockUser } from "../data/mock";

/**
 * Editable display-name state for the mock account.
 * The name is user-editable (Settings → Edit Profile) and persisted to
 * localStorage; email/role stay fixed until real auth arrives (Phase 4).
 */

const STORAGE_KEY = "meronote-user-name";

interface UserContextValue {
  /** Current display name (editable). */
  name: string;
  /** Fixed mock email. */
  email: string;
  /** Fixed mock role. */
  role: "USER" | "ADMIN";
  /** Update the display name; persisted to localStorage. */
  setName: (name: string) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

function readStoredName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState<string>(() => readStoredName() ?? mockUser.name);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // Storage unavailable — keep UI-only state.
    }
  }, [name]);

  const setName = useCallback((next: string) => {
    const trimmed = next.trim();
    if (trimmed) setNameState(trimmed);
  }, []);

  const value = useMemo(
    () => ({ name, email: mockUser.email, role: mockUser.role, setName }),
    [name, setName],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
