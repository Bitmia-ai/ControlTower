/**
 * Fetch JSON with a hard timeout. Returns null on any failure (network error,
 * timeout, non-2xx, non-JSON, missing data field).
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
