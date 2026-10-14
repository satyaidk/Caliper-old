/**
 * Keeps floating tags from landing on top of each other.
 *
 * A hole's diameter and a span across the part both put their tag at the
 * part's centre, and the second one hides the first. This walks the tags top
 * to bottom and pushes any tag that collides with one already placed down by
 * a row, until it lands clear. It moves tags, never measurements: the dimension
 * lines on the model stay exactly where they were drawn.
 */

export interface Placed {
  id: number;
  x: number;
  y: number;
}

/** Approximate tag size in CSS pixels; tags are short, single-line pills. */
const WIDTH = 104;
const ROW = 26;

export function spreadLabels<T extends Placed>(anchors: T[]): T[] {
  const placed: T[] = [];
  const order = [...anchors].sort((a, b) => a.y - b.y || a.id - b.id);
  for (const anchor of order) {
    const next = { ...anchor };
    let guard = 0;
    while (
      guard++ < 12 &&
      placed.some((p) => Math.abs(p.x - next.x) < WIDTH && Math.abs(p.y - next.y) < ROW)
    ) {
      next.y += ROW;
    }
    placed.push(next);
  }
  // Back in the caller's order, so ids still line up with their nodes.
  return anchors.map((a) => placed.find((p) => p.id === a.id)!);
}
