import { describe, expect, it } from "vitest";
import { createAuthGate, isUnauthorizedStatus } from "../authGate";

/**
 * F2 race-hardening verification (mechanism level).
 * The generation guard is the primitive UserProvider threads through every
 * auth transition; these tests pin its ordering contract. Scenario proofs
 * (stale login/me dropped, logout wins, rapid transitions) live in
 * authTransitions.test.ts, which drives this same real module.
 */

describe("createAuthGate", () => {
  it("first generation is current until the next begins", () => {
    const gate = createAuthGate();
    const seq = gate.begin();
    expect(gate.isCurrent(seq)).toBe(true);
    expect(gate.current()).toBe(seq);
  });

  it("begin() retires all older generations", () => {
    const gate = createAuthGate();
    const first = gate.begin();
    const second = gate.begin();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it("observing current() never opens a generation", () => {
    const gate = createAuthGate();
    const seq = gate.begin();
    expect(gate.current()).toBe(seq);
    expect(gate.isCurrent(seq)).toBe(true);
  });

  it("rapid transitions leave exactly the latest generation current", () => {
    const gate = createAuthGate();
    const seqs = [gate.begin(), gate.begin(), gate.begin(), gate.begin()];
    seqs.forEach((seq, i) => {
      expect(gate.isCurrent(seq)).toBe(i === seqs.length - 1);
    });
  });

  it("gates are independent per instance", () => {
    const a = createAuthGate();
    const b = createAuthGate();
    const seqA = a.begin();
    b.begin();
    b.begin();
    expect(a.isCurrent(seqA)).toBe(true);
  });
});

describe("isUnauthorizedStatus", () => {
  it("treats only 401 as session-rejecting", () => {
    expect(isUnauthorizedStatus(401)).toBe(true);
  });

  it("never invalidates on ordinary API failures", () => {
    for (const status of [400, 403, 404, 409, 422, 429, 500, 502, 503]) {
      expect(isUnauthorizedStatus(status)).toBe(false);
    }
  });

  it("never invalidates on network failure (status 0)", () => {
    expect(isUnauthorizedStatus(0)).toBe(false);
  });
});
