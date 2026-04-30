// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJsonWithTimeout } from "./fetch-utils";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchJsonWithTimeout", () => {
  it("returns data when response is ok and JSON has a data field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { hello: "world" } }),
      })) as unknown as typeof fetch
    );
    const result = await fetchJsonWithTimeout<{ hello: string }>("/x");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null when response is non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ data: { ignored: true } }),
      })) as unknown as typeof fetch
    );
    const result = await fetchJsonWithTimeout("/x");
    expect(result).toBeNull();
  });

  it("returns null when json() throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("not json");
        },
      })) as unknown as typeof fetch
    );
    const result = await fetchJsonWithTimeout("/x");
    expect(result).toBeNull();
  });

  it("returns null when fetch is aborted (timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }) as unknown as typeof fetch
    );
    const result = await fetchJsonWithTimeout("/x", 1);
    expect(result).toBeNull();
  });
});
