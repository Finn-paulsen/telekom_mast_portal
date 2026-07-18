import { beforeEach, describe, expect, it } from "vitest";
import {
  getPool,
  pickVariant,
  resetVariantHistory,
  type ActionId,
} from "../client/src/lib/animationVariants";

const ACTIONS: ActionId[] = [
  "align",
  "calibrate",
  "sync",
  "band",
  "diagnose",
  "maintenance",
  "restart",
];

beforeEach(() => resetVariantHistory());

describe("variant pools", () => {
  it("align, calibrate, sync and band have at least 3 variants each", () => {
    expect(getPool("align").length).toBeGreaterThanOrEqual(3);
    expect(getPool("calibrate").length).toBeGreaterThanOrEqual(3);
    expect(getPool("sync").length).toBeGreaterThanOrEqual(3);
    expect(getPool("band").length).toBeGreaterThanOrEqual(3);
  });

  it("diagnose and restart have at least 2 variants each", () => {
    expect(getPool("diagnose").length).toBeGreaterThanOrEqual(2);
    expect(getPool("restart").length).toBeGreaterThanOrEqual(2);
  });

  it("every variant has unique ids and at least 2 stages", () => {
    for (const action of ACTIONS) {
      const pool = getPool(action);
      const ids = new Set(pool.map(v => v.id));
      expect(ids.size).toBe(pool.length);
      for (const variant of pool) {
        expect(variant.stages.length).toBeGreaterThanOrEqual(2);
        for (const stage of variant.stages) {
          expect(stage.duration).toBeGreaterThan(0);
          expect(stage.label.length).toBeGreaterThan(0);
          expect(stage.state.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("restart full sequence covers shutdown and boot phases", () => {
    const full = getPool("restart").find(v => v.id === "restart-full")!;
    const states = full.stages.map(s => s.state).join(" ");
    expect(states).toContain("shutdown");
    expect(states).toContain("boot");
    expect(states).toContain("success");
  });
});

describe("pickVariant (shuffle without direct repetition)", () => {
  it("never returns the same variant twice in a row for multi-variant pools", () => {
    for (const action of ACTIONS) {
      resetVariantHistory();
      if (getPool(action).length < 2) continue;
      let previous = pickVariant(action).id;
      for (let i = 0; i < 50; i++) {
        const next = pickVariant(action).id;
        expect(next).not.toBe(previous);
        previous = next;
      }
    }
  });

  it("eventually uses every variant of a pool", () => {
    resetVariantHistory();
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(pickVariant("align").id);
    expect(seen.size).toBe(getPool("align").length);
  });

  it("single-variant pools always return the same variant", () => {
    resetVariantHistory();
    const a = pickVariant("maintenance");
    const b = pickVariant("maintenance");
    expect(a.id).toBe(b.id);
  });

  it("is deterministic with a seeded rng", () => {
    resetVariantHistory();
    const rngZero = () => 0;
    const first = pickVariant("sync", rngZero);
    const second = pickVariant("sync", rngZero);
    expect(first.id).not.toBe(second.id);
  });
});
