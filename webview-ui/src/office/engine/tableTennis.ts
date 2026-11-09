/**
 * Table tennis: pure helpers for the 1v1 game idle agents play on a
 * TABLE_TENNIS furniture item. Tables are derived from the layout (nothing is
 * persisted); occupancy is derived from characters' `playSlot` claims, so a
 * removed agent or a deleted table needs no cleanup here.
 */

import {
  TABLE_TENNIS_BALL_ARC_PX,
  TABLE_TENNIS_BALL_BOUNCE_AT,
  TABLE_TENNIS_BALL_CROSS_SEC,
  TABLE_TENNIS_BALL_HIT_HEIGHT_PX,
  TABLE_TENNIS_BALL_REBOUND_PX,
  TABLE_TENNIS_GAME_MAX_SEC,
  TABLE_TENNIS_GAME_MIN_SEC,
  TABLE_TENNIS_SWING_NEAR,
  TABLE_TENNIS_TYPE_PATTERN,
  TABLE_TENNIS_WAIT_MAX_SEC,
} from '../../constants.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { PlacedFurniture, PlaySlot } from '../types.js';
import { Direction, TILE_SIZE } from '../types.js';

/** Sprite rows between the sprite top and the table surface's centre line. */
const TABLE_SURFACE_CENTER_PX = 14;
/** The paddle blade sits this far in front of a player's tile centre. */
const BALL_END_INSET_PX = 6;
/** Z-sort nudge putting the ball after the table (zY = footprint bottom). */
const BALL_Z_AFTER_TABLE = 0.25;

export interface TableTennisTable {
  uid: string;
  slots: [PlaySlot, PlaySlot];
  /** Pixel x of the two ball turning points (left, right). */
  ballLeftX: number;
  ballRightX: number;
  /** Pixel y of the ball's resting line (the table surface's centre line). */
  ballY: number;
  /** Z-sort key for the ball: just in front of the table, behind the players. */
  ballZY: number;
}

/**
 * Tables whose two end tiles are both usable: walkable and not somewhere an
 * idle agent may not stand (an Area or its buffer — Areas are for work only).
 * Slot 0 is left of the table facing right, slot 1 right of it facing left,
 * both on the table's lower footprint row: the table top is drawn raised, so
 * its centre line sits over that row's ground and a player standing there is
 * level with the line, paddle at table height.
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
    const row = item.row + Math.floor(entry.footprintH / 2);
    const left = { col: item.col - 1, row };
    const right = { col: item.col + entry.footprintW, row };
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
      ballZY: (item.row + entry.footprintH) * TILE_SIZE + BALL_Z_AFTER_TABLE,
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

export interface TableBall {
  x: number;
  /** Table-surface y under the ball (where its shadow falls). */
  y: number;
  /** Height above the surface. */
  z: number;
  zY: number;
  /** How close the ball is to each player, 0 (far end) to 1 (at the paddle). */
  near: [number, number];
}

/** Height of a ball that left a paddle `u` of the way along one crossing:
 *  an arc down to a bounce on the far half, then a smaller one up to the
 *  opponent's paddle. */
function ballHeight(u: number): number {
  const b = TABLE_TENNIS_BALL_BOUNCE_AT;
  const h = TABLE_TENNIS_BALL_HIT_HEIGHT_PX;
  if (u < b) {
    const s = u / b;
    return h * (1 - s) + 4 * TABLE_TENNIS_BALL_ARC_PX * s * (1 - s);
  }
  const s = (u - b) / (1 - b);
  return h * s + 4 * TABLE_TENNIS_BALL_REBOUND_PX * s * (1 - s);
}

/** The ball at a rally time: hit back and forth, slot 0 serving. */
export function tableBall(table: TableTennisTable, elapsed: number): TableBall {
  const phase = elapsed / TABLE_TENNIS_BALL_CROSS_SEC;
  const leg = Math.floor(phase);
  const u = phase - leg;
  const t = leg % 2 === 0 ? u : 1 - u; // 0 at slot 0's paddle, 1 at slot 1's
  return {
    x: table.ballLeftX + (table.ballRightX - table.ballLeftX) * t,
    y: table.ballY,
    z: ballHeight(u),
    zY: table.ballZY,
    near: [1 - t, t],
  };
}

/** Swing frame (1) while the ball is at this player's paddle, else ready (0). */
export function swingFrame(nearness: number): 0 | 1 {
  return nearness >= 1 - TABLE_TENNIS_SWING_NEAR ? 1 : 0;
}
