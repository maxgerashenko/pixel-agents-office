import { Direction } from '../types.js';

/** The part of a catalog entry arcade placement needs. */
interface ArcadeEntry {
  orientation?: string;
  footprintH: number;
}

/**
 * Where a player stands and which way it faces, so it always looks at the
 * screen. A machine stands like a plant: its body is the bottom footprint tile
 * and the rows above are background (the cabinet top may overlap a wall).
 *
 * - front (screen down): below the body, facing up
 * - side / right (screen right): right of the body, facing left
 * - left (mirrored side, screen left): left of the body, facing right
 * - back (screen up): on the background tile above the body, facing down
 */
export function arcadePlaySpot(
  entry: ArcadeEntry,
  col: number,
  row: number,
): { col: number; row: number; dir: Direction } {
  const bodyRow = row + entry.footprintH - 1;
  switch (entry.orientation) {
    case 'side':
    case 'right':
      return { col: col + 1, row: bodyRow, dir: Direction.LEFT };
    case 'left':
      return { col: col - 1, row: bodyRow, dir: Direction.RIGHT };
    case 'back':
      return { col, row: bodyRow - 1, dir: Direction.DOWN };
    default:
      return { col, row: bodyRow + 1, dir: Direction.UP };
  }
}
