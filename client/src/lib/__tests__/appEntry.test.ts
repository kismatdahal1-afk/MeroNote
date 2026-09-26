import { describe, expect, it } from "vitest";
import { detectStandalone } from "../../pages/landing/hooks/useStandalone";
import { landingEntryTarget } from "../site";

/**
 * Application entry behavior regression tests (browser vs PWA vs APK).
 *
 * Contract under test:
 * - Normal browsers (desktop AND mobile) are never app-mode: screen size,
 *   touch, and UA must not trigger it — detection is display-mode /
 *   standalone-flag / native-bridge / launch-flag only.
 * - `/` shows the landing to guests in normal browsers (target `null`),
 *   routes app-mode guests to `/login` (preserving post-login role
 *   routing), and sends authed users to their role home everywhere.
 */

function browserWindow(search = "", standaloneMatches = false) {
  return {
    matchMedia: () => ({ matches: standaloneMatches }),
    navigator: {},
    location: { search },
  };
}

describe("detectStandalone", () => {
  it("is false with no window (SSR / node)", () => {
    expect(detectStandalone(undefined)).toBe(false);
  });

  it("is false in a normal desktop browser", () => {
    expect(detectStandalone(browserWindow())).toBe(false);
  });

  it("is false in a normal mobile browser (small screen + touch + mobile UA are not signals)", () => {
    const mobile = {
      ...browserWindow(),
      innerWidth: 390,
      ontouchstart: true,
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36", standalone: undefined },
    };
    expect(detectStandalone(mobile)).toBe(false);
  });

  it("is true for installed PWA via display-mode", () => {
    expect(detectStandalone(browserWindow("", true))).toBe(true);
  });

  it("is true for iOS standalone flag", () => {
    expect(
      detectStandalone({ ...browserWindow(), navigator: { standalone: true } }),
    ).toBe(true);
  });

  it("is true for the ?pwa launch flag", () => {
    expect(detectStandalone(browserWindow("?pwa"))).toBe(true);
  });

  it("is true for the ?native APK launch flag", () => {
    expect(detectStandalone(browserWindow("?native=1"))).toBe(true);
  });

  it("is true inside a Capacitor native wrapper", () => {
    expect(
      detectStandalone({
        ...browserWindow(),
        Capacitor: { isNativePlatform: () => true },
      }),
    ).toBe(true);
  });

  it("is false when the Capacitor bridge reports a web platform", () => {
    expect(
      detectStandalone({
        ...browserWindow(),
        Capacitor: { isNativePlatform: () => false },
      }),
    ).toBe(false);
  });

  it("never throws on hostile window shapes", () => {
    expect(
      detectStandalone({
        matchMedia: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
    expect(detectStandalone({})).toBe(false);
  });
});

describe("landingEntryTarget", () => {
  it("shows landing to guests in normal browsers (null = render landing)", () => {
    expect(
      landingEntryTarget({ appMode: false, status: "guest", role: "USER" }),
    ).toBeNull();
  });

  it("sends app-mode (PWA/APK) guests to /login without a next param", () => {
    expect(
      landingEntryTarget({ appMode: true, status: "guest", role: "USER" }),
    ).toBe("/login");
  });

  it("sends authed users to their role home from any entry", () => {
    for (const appMode of [false, true]) {
      expect(
        landingEntryTarget({ appMode, status: "authed", role: "USER" }),
      ).toBe("/dashboard");
      expect(
        landingEntryTarget({ appMode, status: "authed", role: "ADMIN" }),
      ).toBe("/admin");
    }
  });

  it("returns null while loading (caller keeps its skeleton)", () => {
    expect(
      landingEntryTarget({ appMode: true, status: "loading", role: "USER" }),
    ).toBeNull();
    expect(
      landingEntryTarget({ appMode: false, status: "loading", role: "ADMIN" }),
    ).toBeNull();
  });
});
