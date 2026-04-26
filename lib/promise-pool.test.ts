import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "./promise-pool";

describe("mapWithConcurrency", () => {
  it("returns empty array for empty input", async () => {
    const result = await mapWithConcurrency<number, number>([], 4, async (x) => x);
    expect(result).toEqual([]);
  });

  it("preserves input order in the result", async () => {
    const items = [10, 20, 30, 40, 50];
    const result = await mapWithConcurrency(items, 2, async (x) => x * 2);
    expect(result).toEqual([20, 40, 60, 80, 100]);
  });

  it("respects the concurrency cap", async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return 0;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(0);
  });

  it("clamps concurrency below 1 to 1", async () => {
    let active = 0;
    let peak = 0;
    const items = [1, 2, 3];
    await mapWithConcurrency(items, 0, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return 0;
    });
    expect(peak).toBe(1);
  });

  it("propagates rejections", async () => {
    const items = [1, 2, 3];
    await expect(
      mapWithConcurrency(items, 2, async (x) => {
        if (x === 2) throw new Error("boom");
        return x;
      })
    ).rejects.toThrow("boom");
  });

  it("passes the index to the worker", async () => {
    const items = ["a", "b", "c"];
    const result = await mapWithConcurrency(items, 2, async (item, i) => `${i}:${item}`);
    expect(result).toEqual(["0:a", "1:b", "2:c"]);
  });
});
