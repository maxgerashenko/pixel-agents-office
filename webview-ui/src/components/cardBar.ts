/** Pure rules shared by the agent card bars — highlight tier, the mobile
 *  bar's drag-to-reorder order and the desktop row's active-first order
 *  (DOM-free, so they run on the Node runner). */

/** Card highlight tiers: 'focused' = the agent's character is selected in the
 *  office (active background, no border); 'active' = its terminal pane is the
 *  one showing (background + accent border). */
export type CardVariant = 'default' | 'focused' | 'active';

/** One rule for both card bars: the showing terminal pane wins, then the
 *  character selected in the office. Pass activeId null where no pane shows
 *  (VS Code, or the mobile office page). */
export function cardVariant(
  agentId: number,
  { activeId, focusedId }: { activeId: number | null; focusedId: number | null },
): CardVariant {
  if (agentId === activeId) return 'active';
  if (agentId === focusedId) return 'focused';
  return 'default';
}

/** Saved order first (dropping closed agents), then any new agents appended
 *  in creation order — so a reorder survives launches and closes. */
export function mergeOrder(saved: readonly number[], live: readonly number[]): number[] {
  const liveSet = new Set(live);
  const ordered = saved.filter((id) => liveSet.has(id));
  const seen = new Set(ordered);
  for (const id of live) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

/** Whether a card's status counts as active for the desktop row's order:
 *  working, or waiting on the user (permission / input). */
export function isActiveCardStatus(status: string | null): boolean {
  return status === 'working' || status === 'attention';
}

/**
 * The desktop row's order: the previous order (closed agents dropped, new
 * ones appended), with every agent in `becameActive` moved to the front in
 * the order given. An agent that goes idle is never moved — it stays where it
 * is until it becomes active again. Returns `prev`'s contents unchanged when
 * nothing moved, so callers can compare with `sameOrder`.
 */
export function activeFirstOrder(
  prev: readonly number[],
  live: readonly number[],
  becameActive: readonly number[],
): number[] {
  const merged = mergeOrder(prev, live);
  const liveSet = new Set(merged);
  const front = becameActive.filter((id) => liveSet.has(id));
  if (front.length === 0) return merged;
  const frontSet = new Set(front);
  return [...front, ...merged.filter((id) => !frontSet.has(id))];
}

/** Element-wise equality of two orders. */
export function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * The order with `dragId` moved to where the finger is: before the first
 * other card whose horizontal midpoint lies right of `x`, else last.
 * `midpointOf` returns a card's midpoint in the same coordinate space as `x`
 * (null for a card that isn't laid out, which is skipped).
 */
export function reorderByPointer(
  ids: readonly number[],
  dragId: number,
  midpointOf: (id: number) => number | null,
  x: number,
): number[] {
  const others = ids.filter((id) => id !== dragId);
  let insertAt = others.length;
  for (let i = 0; i < others.length; i++) {
    const mid = midpointOf(others[i]);
    if (mid !== null && x < mid) {
      insertAt = i;
      break;
    }
  }
  return [...others.slice(0, insertAt), dragId, ...others.slice(insertAt)];
}

/** The short name a card shows: the part after the last underscore
 *  ("Agent_sonnet5.5_CODE" → "CODE"); names without one, or ending in one,
 *  show whole. The card's tooltip keeps the full name. */
export function cardShortName(name: string): string {
  const tail = name.slice(name.lastIndexOf('_') + 1);
  return tail || name;
}
