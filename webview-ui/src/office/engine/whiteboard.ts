/**
 * The live whiteboard: a WHITEBOARD item on the wall shows how many tasks are active (every task
 * the sky still flies or parks, so everything but merged), and a tap on it opens the big view of
 * the GitHub board (engine/issueBoard). Pure and DOM-free; the canvas draws the plate and App
 * shows the board.
 */
import { WHITEBOARD_FURNITURE_TYPE } from '../../constants.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { OfficeLayout } from '../types.js';
import { TILE_SIZE } from '../types.js';

/** Where the count goes: the centre of a whiteboard's face, in world pixels. */
export interface WhiteboardPlate {
  x: number;
  y: number;
  count: number;
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
      count,
    });
  }
  return plates;
}

/** True when the furniture a tap landed on is a whiteboard. */
export function isWhiteboard(type: string | undefined): boolean {
  return type === WHITEBOARD_FURNITURE_TYPE;
}
