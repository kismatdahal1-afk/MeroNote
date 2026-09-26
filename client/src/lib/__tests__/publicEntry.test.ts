import { describe, expect, it, vi } from "vitest";
import { matchRoutes } from "react-router-dom";
import type { ReactElement } from "react";
import { RequireAuth } from "../../components/auth/RequireAuth";

/**
 * Public entry routing regression test.
 *
 * Bug: "/" was declared as two sibling `path: "/"` routes — the public
 * page and the RequireAuth layout with an index redirect. React Router
 * scores index branches higher, so "/" ALWAYS rendered RequireAuth and
 * guests were bounced to /login. The landing page was unreachable.
 *
 * These tests assert branch RANKING (pure matchRoutes, no DOM):
 * - "/" resolves to the public landing index, outside RequireAuth
 * - /login and /register stay public
 * - every app/admin route stays behind RequireAuth with params intact
 */

// createBrowserRouter touches window at module scope, so stub the minimal
// browser surface before loading the real route table.
const windowStub: Record<string, unknown> = {
  history: {
    state: null,
    length: 1,
    pushState: () => {},
    replaceState: () => {},
    go: () => {},
    back: () => {},
    forward: () => {},
  },
  location: {
    pathname: "/",
    search: "",
    hash: "",
    href: "http://localhost/",
    origin: "http://localhost",
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};
vi.stubGlobal("window", windowStub);
vi.stubGlobal("document", { defaultView: windowStub });

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { appRoutes } = await import("../../router");

function branchFor(pathname: string) {
  const matches = matchRoutes(appRoutes, pathname);
  expect(matches, `expected a branch for "${pathname}"`).not.toBeNull();
  const gated = matches!.some(
    (m) => (m.route.element as ReactElement | null | undefined)?.type === RequireAuth,
  );
  return { matches: matches!, leaf: matches![matches!.length - 1], gated };
}

describe("public entry routing", () => {
  it('"/" resolves to the public landing index, outside the auth gate', () => {
    const { leaf, gated } = branchFor("/");
    expect(leaf.route.index).toBe(true);
    expect(gated).toBe(false);
  });

  it('"/login" and "/register" stay public', () => {
    for (const pathname of ["/login", "/register"]) {
      const { leaf, gated } = branchFor(pathname);
      expect(leaf.route.path).toBe(pathname.slice(1));
      expect(gated).toBe(false);
    }
  });

  it("app routes stay behind the auth gate", () => {
    for (const pathname of [
      "/dashboard",
      "/semesters",
      "/subjects/sub-1",
      "/resources",
      "/resources/res-1",
      "/search",
      "/reader/res-1",
      "/favorites",
      "/bookmarks",
      "/downloads",
      "/notices",
      "/settings",
      "/help",
    ]) {
      expect(branchFor(pathname).gated, pathname).toBe(true);
    }
  });

  it("admin routes stay behind the auth gate", () => {
    for (const pathname of [
      "/admin",
      "/admin/notices",
      "/admin/semesters",
      "/admin/resources",
      "/admin/resources/res-1",
      "/admin/reader/res-1",
      "/admin/drafts",
      "/admin/trash",
      "/admin/settings",
    ]) {
      expect(branchFor(pathname).gated, pathname).toBe(true);
    }
  });

  it("preserves route params", () => {
    expect(branchFor("/semesters/sem-3").matches.at(-1)?.params).toMatchObject({
      semesterId: "sem-3",
    });
    expect(branchFor("/resources/res-9").matches.at(-1)?.params).toMatchObject({
      resourceId: "res-9",
    });
  });

  it("unknown paths still resolve (NotFound branch)", () => {
    expect(branchFor("/no-such-page").matches.length).toBeGreaterThan(0);
  });
});
