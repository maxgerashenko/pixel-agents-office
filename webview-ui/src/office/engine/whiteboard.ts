/**
 * The live whiteboard: a WHITEBOARD item on the wall shows how many tasks are active (every task
 * the sky still flies or parks, so everything but merged), and a tap on it lists them with their
 * pull request numbers. Pure and DOM-free; the canvas draws the plate and App shows the list.
 */
import {
  WHITEBOARD_FURNITURE_TYPE,
  WHITEBOARD_PLATE_FRAC_H,
  WHITEBOARD_PLATE_FRAC_W,
} from '../../constants.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { OfficeLayout } from '../types.js';
import { TILE_SIZE } from '../types.js';
import type { SkyTask } from './skyTasks.js';

/** Where the count goes: the centre of a whiteboard's face, in world pixels. */
export interface WhiteboardPlate {
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
}

export interface WhiteboardEntry {
  id: string;
  title: string;
  /** The pull request number, when the task's id carries one (`branch#12`). */
  pr: number | null;
  stage: SkyTask['stage'];
  url?: string;
}

/** The pull request number a task id ends with (`branch#12`), or null. */
export function taskPrNumber(id: string): number | null {
  const m = /#(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** The popup's rows, in the board's order. */
export function whiteboardEntries(tasks: SkyTask[]): WhiteboardEntry[] {
  return tasks
    .filter((t) => t.stage !== 'merged')
    .map((t) => ({ id: t.id, title: t.title, pr: taskPrNumber(t.id), stage: t.stage, url: t.url }));
}

/** One plate per whiteboard in the layout, each carrying the same count. */
export function whiteboardPlates(layout: OfficeLayout, count: number): WhiteboardPlate[] {
  const plates: WhiteboardPlate[] = [];
  for (const f of layout.furniture) {
    if (f.type !== WHITEBOARD_FURNITURE_TYPE) continue;
    const entry = getCatalogEntry(f.type);
    const w = (entry?.footprintW ?? 2) * TILE_SIZE;
    const h = (entry?.footprintH ?? 2) * TILE_SIZE;
    plates.push({
      x: f.col * TILE_SIZE + w / 2,
      y: f.row * TILE_SIZE + h / 2,
      w: w * WHITEBOARD_PLATE_FRAC_W,
      h: h * WHITEBOARD_PLATE_FRAC_H,
      count,
    });
  }
  return plates;
}

/** True when the furniture a tap landed on is a whiteboard. */
export function isWhiteboard(type: string | undefined): boolean {
  return type === WHITEBOARD_FURNITURE_TYPE;
}
