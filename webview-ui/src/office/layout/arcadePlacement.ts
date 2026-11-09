import { PLAY_FURNITURE_TYPE_PATTERN } from '../../constants.js';
import { Direction } from '../types.js';

/** The part of a catalog entry arcade placement needs. */
interface ArcadeEntry {
  orientation?: string;
  footprintH: number;
}

export function isArcadeType(type: string): boolean {
  return PLAY_FURNITURE_TYPE_PATTERN.test(type);
}

/**
 * Tiles that must be wall for an arcade machine to stand here: it only goes
 * against a wall, never free-standing. A front machine stands under the top
 * wall; a side machine faces away from the wall it leans on (`side` faces right,
 * so its back is to the left wall; the mirrored `left` is the reverse). There
 * is no back orientation, so nothing ever leans on the bottom wall.
 */
export function arcadeWallTiles(
  entry: ArcadeEntry,
  col: number,
  row: number,
): Array<{ col: number; row: number }> {
  const rows = Array.from({ length: entry.footprintH }, (_, i) => row + i);
  if (entry.orientation === 'side') return rows.map((r) => ({ col: col - 1, row: r }));
  if (entry.orientation === 'left') return rows.map((r) => ({ col: col + 1, row: r }));
  return [{ col, row: row - 1 }];
}

/** Where a player stands (in front of the machine) and which way it faces. */
export function arcadePlaySpot(
  entry: ArcadeEntry,
  col: number,
  row: number,
): { col: number; row: number; dir: Direction } {
  if (entry.orientation === 'side') {
    return { col: col + 1, row: row + entry.footprintH - 1, dir: Direction.LEFT };
  }
  if (entry.orientation === 'left') {
    return { col: col - 1, row: row + entry.footprintH - 1, dir: Direction.RIGHT };
  }
  return { col, row: row + entry.footprintH, dir: Direction.UP };
}
