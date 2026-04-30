/**
 * Pure helper for "sticky-bottom" scroll logic on the Live page.
 *
 * Returns true when the viewport bottom is within `threshold` pixels
 * of the document bottom (or when the document is shorter than the
 * viewport). Extracted from `app/project/[id]/live/page.tsx` so it is
 * unit-testable without a DOM.
 */
export function isNearBottom(
  scrollY: number,
  innerHeight: number,
  scrollHeight: number,
  threshold: number
): boolean {
  const viewportBottom = scrollY + innerHeight;
  return viewportBottom >= scrollHeight - threshold;
}
