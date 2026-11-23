import { skyAt } from '../office/engine/skyCycle.js';

/** The tool rows an agent has open, reduced to what the alert needs. */
interface ToolRow {
  done: boolean;
  permissionWait?: boolean;
}

/** Agents with a permission prompt still open (a not-done tool waiting on the
 *  user). Drives the whole-screen "needs you" edge; it goes empty the moment
 *  the permission is answered and the tool resumes or finishes. */
export function agentsNeedingPermission(
  agentTools: Readonly<Record<number, readonly ToolRow[] | undefined>>,
): number[] {
  const ids: number[] = [];
  for (const [key, tools] of Object.entries(agentTools)) {
    if (tools?.some((t) => t.permissionWait && !t.done)) ids.push(Number(key));
  }
  return ids;
}

/** Whether the sky is in its night half at hour fraction `t` (the stars-out
 *  test the fast-forward button uses). The alert is pink then, purple else. */
export function needsYouSkyIsNight(t: number): boolean {
  return skyAt(t).starAlpha >= 0.5;
}
