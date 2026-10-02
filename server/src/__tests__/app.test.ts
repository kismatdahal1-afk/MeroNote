/**
 * Express bootstrap tests (no database, no network).
 *
 * Locks in the production proxy configuration: Render terminates TLS at its
 * router (single hop), so exactly one trusted proxy hop keeps `req.ip` (and
 * therefore rate-limit attribution) correct without allowing IP spoofing.
 */

import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("Express bootstrap", () => {
  it("trusts exactly one proxy hop (Render router) and nothing more", () => {
    const app = createApp();
    expect(app.get("trust proxy")).toBe(1);
  });
});
