/**
 * Table tennis: pure helpers for the 1v1 game idle agents play on a
 * TABLE_TENNIS furniture item. Tables are derived from the layout (nothing is
 * persisted); occupancy is derived from characters' `playSlot` claims, so a
 * removed agent or a deleted table needs no cleanup here.
 */

import {
  TABLE_TENNIS_BALL_ARC_PX,
  TABLE_TENNIS_BALL_CROSS_SEC,
  TABLE_TENNIS_GAME_MAX_SEC,
  TABLE_TENNIS_GAME_MIN_SEC,
  TABLE_TENNIS_TYPE_PATTERN,
  TABLE_TENNIS_WAIT_MAX_SEC,
} from '../../constants.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { PlacedFurniture, PlaySlot } from '../types.js';
import { Direction, TILE_SIZE } from '../types.js';

/** Sprite rows between the sprite top and the table surface's centre line. */
const TABLE_SURFACE_CENTER_PX = 14;
/** The ball stays this far in from each player's tile centre (paddle reach). */
const BALL_END_INSET_PX = 8;

export interface TableTennisTable {
  uid: string;
  slots: [PlaySlot, PlaySlot];
  /** Pixel x of the two ball turning points (left, right). */
  ballLeftX: number;
  ballRightX: number;
  /** Pixel y of the ball's resting line (the table surface). */
  ballY: number;
}

/**
 * Tables whose two end tiles are both usable: walkable and not somewhere an
 * idle agent may not stand (an Area or its buffer — Areas are for work only).
 * Slot 0 is left of the table facing right, slot 1 right of it facing left.
 */
export function deriveTables(
  furniture: readonly PlacedFurniture[],
  isStandable: (col: number, row: number) => boolean,
  noIdleTileKeys: ReadonlySet<string>,
): TableTennisTable[] {
  const tables: TableTennisTable[] = [];
  for (const item of furniture) {
    if (!TABLE_TENNIS_TYPE_PATTERN.test(item.type)) continue;
    const entry = getCatalogEntry(item.type);
    if (!entry) continue;
    const left = { col: item.col - 1, row: item.row };
    const right = { col: item.col + entry.footprintW, row: item.row };
    const ok = [left, right].every(
      (t) => isStandable(t.col, t.row) && !noIdleTileKeys.has(`${t.col},${t.row}`),
    );
    if (!ok) continue;
    tables.push({
      uid: item.uid,
      slots: [
        { tableUid: item.uid, index: 0, col: left.col, row: left.row, dir: Direction.RIGHT },
        { tableUid: item.uid, index: 1, col: right.col, row: right.row, dir: Direction.LEFT },
      ],
      ballLeftX: left.col * TILE_SIZE + TILE_SIZE / 2 + BALL_END_INSET_PX,
      ballRightX: right.col * TILE_SIZE + TILE_SIZE / 2 - BALL_END_INSET_PX,
      ballY: item.row * TILE_SIZE + TABLE_SURFACE_CENTER_PX,
    });
  }
  return tables;
}

export interface TableGame {
  /** Seconds the one player at the table has waited for an opponent. */
  waited: number;
  /** Seconds the rally has run. */
  elapsed: number;
  /** How long this game lasts. */
  duration: number;
}

export function newTableGame(): TableGame {
  return {
    waited: 0,
    elapsed: 0,
    duration:
      TABLE_TENNIS_GAME_MIN_SEC +
      Math.random() * (TABLE_TENNIS_GAME_MAX_SEC - TABLE_TENNIS_GAME_MIN_SEC),
  };
}

/** What the table needs done after a tick. */
export type TableVerdict = 'empty' | 'waiting' | 'playing' | 'give-up' | 'finished';

/**
 * Advance a table's game by dt given how many players stand at their ends.
 * 'give-up' / 'finished' tell the caller to send the players off (the game is
 * reset); 'playing' means a rally is on.
 */
export function advanceTableGame(game: TableGame, arrived: number, dt: number): TableVerdict {
  if (arrived === 0) {
    game.waited = 0;
    game.elapsed = 0;
    return 'empty';
  }
  if (arrived === 1) {
    game.elapsed = 0;
    game.waited += dt;
    if (game.waited >= TABLE_TENNIS_WAIT_MAX_SEC) {
      game.waited = 0;
      return 'give-up';
    }
    return 'waiting';
  }
  game.waited = 0;
  game.elapsed += dt;
  if (game.elapsed >= game.duration) {
    game.elapsed = 0;
    game.duration = newTableGame().duration;
    return 'finished';
  }
  return 'playing';
}

/** Ball position and height above the table at a rally time, hit back and forth. */
export function tableBall(
  table: TableTennisTable,
  elapsed: number,
): { x: number; y: number; z: number } {
  const phase = elapsed / TABLE_TENNIS_BALL_CROSS_SEC;
  const leg = Math.floor(phase);
  const u = phase - leg;
  const t = leg % 2 === 0 ? u : 1 - u;
  return {
    x: table.ballLeftX + (table.ballRightX - table.ballLeftX) * t,
    y: table.ballY,
    z: 4 * TABLE_TENNIS_BALL_ARC_PX * u * (1 - u),
  };
}
