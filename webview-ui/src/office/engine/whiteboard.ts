/**
 * The live whiteboard: a WHITEBOARD (2x2) or WHITEBOARD_SMALL (1x1) item on the wall shows how many tasks are active (every task
 * the sky still flies or parks, so everything but merged), and a tap on it opens the big view of
 * the GitHub board (engine/issueBoard). Pure and DOM-free; the canvas draws the plate and App
 * shows the board.
 */
import {
  WHITEBOARD_FURNITURE_TYPE,
  WHITEBOARD_SMALL_COUNT_MAX,
  WHITEBOARD_SMALL_FURNITURE_TYPE,
} from '../../constants.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { OfficeLayout } from '../types.js';
import { TILE_SIZE } from '../types.js';

/** Where the count goes: the centre of a whiteboard's face, in world pixels. */
export interface WhiteboardPlate {
  x: number;
  y: number;
  count: number;
  /** The small board: digits only, no plate (its face is clean and narrower than a plate). */
  bare?: boolean;
}

/** One plate per whiteboard in the layout, each carrying the same count (the small one tops out at 99). */
export function whiteboardPlates(layout: OfficeLayout, count: number): WhiteboardPlate[] {
  const plates: WhiteboardPlate[] = [];
  for (const f of layout.furniture) {
    if (!isWhiteboard(f.type)) continue;
    const small = f.type === WHITEBOARD_SMALL_FURNITURE_TYPE;
    const entry = getCatalogEntry(f.type);
    const w = (entry?.footprintW ?? 2) * TILE_SIZE;
    const h = (entry?.footprintH ?? 2) * TILE_SIZE;
    plates.push({
      x: f.col * TILE_SIZE + w / 2,
      y: f.row * TILE_SIZE + h / 2,
      count: small ? Math.min(count, WHITEBOARD_SMALL_COUNT_MAX) : count,
      ...(small ? { bare: true } : {}),
    });
  }
  return plates;
}

/** True when the furniture a tap landed on is a whiteboard, big or small. */
export function isWhiteboard(type: string | undefined): boolean {
  return type === WHITEBOARD_FURNITURE_TYPE || type === WHITEBOARD_SMALL_FURNITURE_TYPE;
}
