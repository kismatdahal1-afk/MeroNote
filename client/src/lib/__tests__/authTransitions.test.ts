import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, fetchMe, updateProfileRequest, type AuthUser } from "../authApi";
import { createAuthGate, isUnauthorizedStatus } from "../authGate";
import { downloadMirrorKey } from "../downloadRegistry";
import { libraryMirrorKey } from "../librarySync";
import { mirrorKeyFor } from "../semesterPlanApi";

/**
 * F2 authentication state + race verification, extended by F4.
 *
 * Part A exercises REAL modules over mocked transport: authApi surfaces 401
 * (and only 401) with its status intact, which is the trigger both
 * invalidation call sites (UserProvider.setName, useApiQuery) discriminate
 * on via the shared isUnauthorizedStatus rule.
 *
 * Part B drives the REAL createAuthGate through transition bodies ported
 * line-for-line from client/src/state/UserProvider.tsx (login / refresh /
 * logout / setName / invalidateSession). Deferred promises control
 * completion order deterministically. If provider wiring changes, this
 * harness must be mirrored — the gate itself is imported, not copied.
 *
 * Part C proves the F4 refresh-then-invalidate integration on the same
 * ports: the injected `refresher` stands in for the shared single-flight
 * refreshSession() (unit-tested separately with real transport in
 * authRefresh.test.ts).
 */

const USER_A: AuthUser = { id: "a1", name: "A", email: "a@example.com", role: "USER" };
const USER_B: AuthUser = { id: "b2", name: "B", email: "b@example.com", role: "USER" };

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", (url: unknown, init?: RequestInit) => handler(String(url), init));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type PlainStatus = "loading" | "authed" | "guest";

interface HarnessSink {
  user: AuthUser | null;
  status: PlainStatus;
}

/**
 * Faithful port of the UserProvider transition bodies: the gate is real,
 * the setState sink is local ({user,status} + a render-mirror statusRef,
 * exactly like statusRef in the provider). Request promises are injected
 * so tests control resolution order.
 */
function createHarness(initial: PlainStatus = "guest") {
  const gate = createAuthGate();
  const sink: HarnessSink = { user: null, status: initial };
  const statusRef = { current: initial as PlainStatus };

  const writeAuthed = (user: AuthUser): void => {
    sink.user = user;
    sink.status = "authed";
    statusRef.current = "authed";
  };
  const writeGuest = (): void => {
    sink.user = null;
    sink.status = "guest";
    statusRef.current = "guest";
  };

  // Port of UserProvider.invalidateSession.
  const invalidateSession = (): void => {
    if (statusRef.current !== "authed") return;
    gate.begin();
    writeGuest();
  };

  return {
    gate,
    sink,
    statusRef,
    invalidateSession,
    // Port of UserProvider.login (minus the transport call).
    async login(request: Promise<AuthUser>): Promise<AuthUser> {
      const seq = gate.begin();
      const authed = await request;
      if (!gate.isCurrent(seq)) return authed;
      writeAuthed(authed);
      return authed;
    },
    // Port of UserProvider.refresh (F4: 401 → shared refresher → adopt).
    async refresh(request: Promise<AuthUser>, refresher?: () => Promise<AuthUser>): Promise<void> {
      const seq = gate.begin();
      try {
        const me = await request;
        if (!gate.isCurrent(seq)) return;
        writeAuthed(me);
      } catch (err) {
        if (!gate.isCurrent(seq)) return;
        if (err instanceof AuthError && isUnauthorizedStatus(err.status) && refresher) {
          try {
            const me = await refresher();
            if (!gate.isCurrent(seq)) return;
            writeAuthed(me);
            return;
          } catch {
            // Fall through to guest below.
          }
        }
        if (!gate.isCurrent(seq)) return;
        writeGuest();
      }
    },
    // Port of UserProvider.logout.
    async logout(request: Promise<void>): Promise<void> {
      const seq = gate.begin();
      try {
        await request;
      } finally {
        if (!gate.isCurrent(seq)) return;
        writeGuest();
      }
    },
    // Port of UserProvider.setName (F4: 401 → shared refresher → single retry
    // via a fresh patch() call, never a second refresh).
    async setName(patch: () => Promise<AuthUser>, refresher: () => Promise<AuthUser>): Promise<AuthUser> {
      const seq = gate.current();
      try {
        const updated = await patch();
        if (!gate.isCurrent(seq)) return updated;
        sink.user = updated;
        return updated;
      } catch (err) {
        if (err instanceof AuthError && isUnauthorizedStatus(err.status)) {
          try {
            const me = await refresher();
            if (!gate.isCurrent(seq)) return me;
            const updated = await patch();
            if (!gate.isCurrent(seq)) return updated;
            sink.user = updated;
            return updated;
          } catch (retryErr) {
            if (retryErr instanceof AuthError && isUnauthorizedStatus(retryErr.status)) {
              invalidateSession();
            }
            throw retryErr;
          }
        }
        throw err;
      }
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("Part A — authApi surfaces 401 with status intact (real transport)", () => {
  it("fetchMe rejects with AuthError status 401", async () => {
    mockFetchOnce(() => jsonResponse({ status: "error", message: "Authentication required." }, 401));
    await expect(fetchMe()).rejects.toMatchObject({ name: "AuthError", status: 401 });
  });

  it("updateProfileRequest preserves non-401 statuses for discrimination", async () => {
    for (const status of [403, 404, 409, 422, 500, 503]) {
      mockFetchOnce(() => jsonResponse({ status: "error", message: "Nope." }, status));
      await expect(updateProfileRequest("New Name")).rejects.toMatchObject({ status });
    }
  });

  it("network failure surfaces as status 0, never 401", async () => {
    mockFetchOnce(() => Promise.reject(new TypeError("fetch failed")));
    await expect(fetchMe()).rejects.toMatchObject({ name: "AuthError", status: 0 });
  });
});

describe("Part B — stale completions never overwrite newer state", () => {
  it("Test 2: stale /me cannot resurrect user A after logout + login B", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const meA = deferred<AuthUser>();
    const logoutReq = deferred<void>();
    const loginB = deferred<AuthUser>();

    const pMe = h.refresh(meA.promise);
    const pLogout = h.logout(logoutReq.promise);
    logoutReq.resolve();
    await pLogout;
    expect(h.sink.status).toBe("guest");
    const pLogin = h.login(loginB.promise);
    loginB.resolve(USER_B);
    await pLogin;
    expect(h.sink.user).toEqual(USER_B);
    meA.resolve(USER_A);
    await pMe;
    await flush();
    expect(h.sink.user).toEqual(USER_B);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 3: stale login A cannot overwrite newer login B (either order)", async () => {
    const h = createHarness();
    const loginA = deferred<AuthUser>();
    const loginB = deferred<AuthUser>();
    const pA = h.login(loginA.promise);
    const pB = h.login(loginB.promise);
    loginB.resolve(USER_B);
    await pB;
    expect(h.sink.user).toEqual(USER_B);
    loginA.resolve(USER_A);
    await pA;
    await flush();
    expect(h.sink.user).toEqual(USER_B);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 3b: reverse completion order still leaves the latest-started login winning", async () => {
    const h = createHarness();
    const loginA = deferred<AuthUser>();
    const loginB = deferred<AuthUser>();
    const pA = h.login(loginA.promise);
    const pB = h.login(loginB.promise);
    // A started first, so its earlier completion is already stale: dropped.
    loginA.resolve(USER_A);
    await pA;
    await flush();
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
    loginB.resolve(USER_B);
    await pB;
    await flush();
    expect(h.sink.user).toEqual(USER_B);
  });

  it("Test 4: logout during pending refresh — late success never restores A", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const meA = deferred<AuthUser>();
    const logoutReq = deferred<void>();
    const pMe = h.refresh(meA.promise);
    const pLogout = h.logout(logoutReq.promise);
    logoutReq.resolve();
    await pLogout;
    meA.resolve(USER_A);
    await pMe;
    await flush();
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });

  it("Test 4b: logout during pending login — late success never restores A", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const loginA = deferred<AuthUser>();
    const logoutReq = deferred<void>();
    const pLogin = h.login(loginA.promise);
    const pLogout = h.logout(logoutReq.promise);
    logoutReq.resolve();
    await pLogout;
    loginA.resolve(USER_A);
    await pLogin;
    await flush();
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });

  it("Test 5: repeated logout is safe and stays guest", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const first = deferred<void>();
    const second = deferred<void>();
    const p1 = h.logout(first.promise);
    const p2 = h.logout(second.promise);
    second.resolve();
    await p2;
    first.resolve();
    await p1;
    await flush();
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });

  it("Test 8: rapid LOGIN A → LOGOUT → LOGIN B ends on B", async () => {
    const h = createHarness();
    const reqA = deferred<AuthUser>();
    const reqLogout = deferred<void>();
    const reqB = deferred<AuthUser>();
    const pA = h.login(reqA.promise);
    const pLogout = h.logout(reqLogout.promise);
    const pB = h.login(reqB.promise);
    reqA.resolve(USER_A);
    await pA;
    reqLogout.resolve();
    await pLogout;
    reqB.resolve(USER_B);
    await pB;
    await flush();
    expect(h.sink.user).toEqual(USER_B);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 1: 401 invalidates an authenticated session", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    h.invalidateSession();
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });

  it("Test 1b: setName 401 + failed refresh clears auth state and rethrows", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const patch = () => Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    const refresher = () => Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    await expect(h.setName(patch, refresher)).rejects.toMatchObject({ status: 401 });
    await flush();
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });

  it("Test 6: setName failure with non-401 keeps the session, skips refresh, rethrows", async () => {
    for (const status of [403, 404, 409, 422, 500, 503, 0]) {
      const h = createHarness("authed");
      h.sink.user = USER_A;
      let refresherCalls = 0;
      const patch = () => Promise.reject<AuthUser>(new AuthError(status, "Failure."));
      const refresher = () => {
        refresherCalls += 1;
        return Promise.resolve(USER_A);
      };
      await expect(h.setName(patch, refresher)).rejects.toMatchObject({ status });
      expect(refresherCalls).toBe(0);
      expect(h.sink.user).toEqual(USER_A);
      expect(h.sink.status).toBe("authed");
    }
  });

  it("Test 6b: stray invalidation while guest never kills a concurrent login", async () => {
    const h = createHarness();
    const loginB = deferred<AuthUser>();
    const pLogin = h.login(loginB.promise);
    h.invalidateSession();
    loginB.resolve(USER_B);
    await pLogin;
    await flush();
    expect(h.sink.user).toEqual(USER_B);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 7: per-user storage namespaces never collide (real key fns)", () => {
    const userA = "0000000000000000000000a1";
    const userB = "0000000000000000000000b2";
    const guestFav = libraryMirrorKey("favorites", null);
    const favA = libraryMirrorKey("favorites", userA);
    const favB = libraryMirrorKey("favorites", userB);
    expect(new Set([guestFav, favA, favB]).size).toBe(3);
    expect(favA).toContain(userA);
    expect(favB).toContain(userB);
    expect(mirrorKeyFor(userA)).not.toBe(mirrorKeyFor(userB));
    expect(mirrorKeyFor(userA)).not.toBe(mirrorKeyFor(null));
    expect(mirrorKeyFor(null)).toBe("meronote-semester-enrollment");
    expect(downloadMirrorKey(userA)).not.toBe(downloadMirrorKey(userB));
    expect(downloadMirrorKey(null)).toBe("meronote.library.downloads.v1");
  });
});

describe("Part C — F4 refresh-then-invalidate integration", () => {
  const REFRESHED_A: AuthUser = { id: "a1", name: "A fresh", email: "a@example.com", role: "USER" };

  it("Test 13: refresh 401 + failed shared refresh → guest", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    let refresherCalls = 0;
    const me401 = Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    const refresher = () => {
      refresherCalls += 1;
      return Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    };
    await h.refresh(me401, refresher);
    await flush();
    expect(refresherCalls).toBe(1);
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });

  it("Test 14: refresh 401 + successful shared refresh → stays authenticated", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const me401 = Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    await h.refresh(me401, () => Promise.resolve(REFRESHED_A));
    await flush();
    expect(h.sink.user).toEqual(REFRESHED_A);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 14b: setName 401 + refresh + retry success → edit applied, stays authed", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const UPDATED: AuthUser = { ...USER_A, name: "A new" };
    let attempts = 0;
    const patch = () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject<AuthUser>(new AuthError(401, "Authentication required."))
        : Promise.resolve(UPDATED);
    };
    const result = await h.setName(patch, () => Promise.resolve(REFRESHED_A));
    await flush();
    expect(attempts).toBe(2);
    expect(result).toEqual(UPDATED);
    expect(h.sink.user).toEqual(UPDATED);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 12 (client): three concurrent 401s share one refresh operation", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    let refresherCalls = 0;
    const shared = () => {
      refresherCalls += 1;
      return Promise.resolve(REFRESHED_A);
    };
    const fail401 = () => Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    await Promise.all([h.refresh(fail401(), shared), h.refresh(fail401(), shared), h.refresh(fail401(), shared)]);
    await flush();
    expect(refresherCalls).toBe(1);
    expect(h.sink.user).toEqual(REFRESHED_A);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 19: stale shared-refresh completion never resurrects A over B", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    const me401 = Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    const refresherGate = deferred<AuthUser>();
    const logoutReq = deferred<void>();
    const loginB = deferred<AuthUser>();
    const pRefresh = h.refresh(me401, () => refresherGate.promise);
    await flush();
    const pLogout = h.logout(logoutReq.promise);
    logoutReq.resolve();
    await pLogout;
    const pLogin = h.login(loginB.promise);
    loginB.resolve(USER_B);
    await pLogin;
    refresherGate.resolve(REFRESHED_A);
    await pRefresh;
    await flush();
    expect(h.sink.user).toEqual(USER_B);
    expect(h.sink.status).toBe("authed");
  });

  it("Test 20: continuous 401s cause exactly one refresh, then guest (no loop)", async () => {
    const h = createHarness("authed");
    h.sink.user = USER_A;
    let refresherCalls = 0;
    const always401 = () => Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    const refresher = () => {
      refresherCalls += 1;
      return Promise.reject<AuthUser>(new AuthError(401, "Authentication required."));
    };
    await h.refresh(always401(), refresher);
    await flush();
    expect(refresherCalls).toBe(1);
    expect(h.sink.user).toBeNull();
    expect(h.sink.status).toBe("guest");
  });
});
