/**
 * Promise pool — run async tasks with bounded concurrency.
 *
 * `Promise.all(items.map(fn))` starts all tasks at once, which is fine for
 * cheap operations but pathological when each task allocates large transient
 * heap (streamed file reads, JSON.parse over multi-MB inputs). This helper
 * caps in-flight tasks to `concurrency` while preserving the input order in
 * the result array.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}
