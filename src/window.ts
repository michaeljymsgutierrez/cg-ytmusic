/**
 * Compute the visible slice of a scrollable list so the selected row stays on screen,
 * centering it once the list is longer than the viewport.
 */
export function windowFor(
  count: number,
  selected: number,
  maxRows: number,
): { start: number; end: number } {
  if (count <= maxRows) return { start: 0, end: count };
  let start = selected - Math.floor(maxRows / 2);
  start = Math.max(0, Math.min(start, count - maxRows));
  return { start, end: start + maxRows };
}
