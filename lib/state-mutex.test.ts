/**
 * lib/state-mutex.test.ts
 *
 * Unit tests for `withProjectLock` — a per-project promise-chain mutex used
 * to serialize state.json read-modify-write sequences in API routes.
 */

import { describe, it, expect } from "vitest";
import { withProjectLock } from "./state-mutex";

describe("withProjectLock", () => {
  it("serializes concurrent calls on the same key", async () => {
    const order: number[] = [];
    const key = "/tmp/state-mutex-serialize";

    const a = withProjectLock(key, async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    // Schedule b after a is registered. b must wait for a even though a sleeps.
    const b = withProjectLock(key, async () => {
      order.push(2);
    });

    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });

  it("does not serialize calls on different keys", async () => {
    const order: number[] = [];

    const a = withProjectLock("/tmp/state-mutex-iso-1", async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
    });
    const b = withProjectLock("/tmp/state-mutex-iso-2", async () => {
      order.push(2);
    });

    await Promise.all([a, b]);
    // p2 has no delay, so it finishes first if the keys are isolated.
    expect(order).toEqual([2, 1]);
  });

  it("releases the lock when fn throws", async () => {
    const key = "/tmp/state-mutex-throw";

    await expect(
      withProjectLock(key, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    // A subsequent caller must still run; if the lock leaked, this hangs.
    let ran = false;
    await withProjectLock(key, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("preserves FIFO ordering across many concurrent callers on the same key", async () => {
    const key = "/tmp/state-mutex-fifo";
    const order: number[] = [];
    const N = 10;

    const promises: Promise<void>[] = [];
    for (let i = 0; i < N; i += 1) {
      promises.push(
        withProjectLock(key, async () => {
          // small randomized delay; FIFO must still hold
          await new Promise((r) => setTimeout(r, 1));
          order.push(i);
        })
      );
    }
    await Promise.all(promises);

    expect(order).toEqual(Array.from({ length: N }, (_, i) => i));
  });

  it("returns the value produced by fn", async () => {
    const key = "/tmp/state-mutex-return";
    const result = await withProjectLock(key, async () => 42);
    expect(result).toBe(42);
  });
});
