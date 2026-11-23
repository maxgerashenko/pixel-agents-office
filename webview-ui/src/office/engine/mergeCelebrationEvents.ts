/**
 * Hand-off from the task board to the celebration: the sky tells it a pull request just merged, the
 * overlay (MergeCelebration) plays it. Kept apart so the board code never imports React.
 */
type Listener = (merged: number) => void;
const listeners = new Set<Listener>();

/** Subscribes to merges; returns the unsubscribe. */
export function onSkyMerge(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** `count` tasks that were in flight have just merged. */
export function announceSkyMerge(count: number): void {
  if (count > 0) for (const fn of [...listeners]) fn(count);
}

/** True while a celebration hides the button's own sprite (the overlay draws it instead). */
let celebrating = false;
const stateListeners = new Set<() => void>();
export function setCelebrating(next: boolean): void {
  if (celebrating === next) return;
  celebrating = next;
  for (const fn of [...stateListeners]) fn();
}
export function isCelebrating(): boolean {
  return celebrating;
}
export function subscribeCelebrating(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => {
    stateListeners.delete(fn);
  };
}
