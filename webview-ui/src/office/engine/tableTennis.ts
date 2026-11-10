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
  TABLE_TENNIS_GAME_OVER_PAUSE_SEC,
  TABLE_TENNIS_POINT_PAUSE_SEC,
  TABLE_TENNIS_RALLY_MAX_HITS,
  TABLE_TENNIS_RALLY_MIN_HITS,
  TABLE_TENNIS_SCORE_LIFT_PX,
  TABLE_TENNIS_SERVES_PER_TURN,
  TABLE_TENNIS_SWING_NEAR,
  TABLE_TENNIS_TYPE_PATTERN,
  TABLE_TENNIS_WAIT_MAX_SEC,
  TABLE_TENNIS_WIN_BY,
  TABLE_TENNIS_WIN_POINTS,
} from '../../constants.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { PlacedFurniture, PlaySlot } from '../types.js';
import { Direction, TILE_SIZE } from '../types.js';

/** Sprite rows between the sprite top and the table surface's centre line. */
const TABLE_SURFACE_CENTER_PX = 14;
/** The paddle blade sits this far in front of a player's tile centre. */
const BALL_END_INSET_PX = 6;
/** Vertical table: ball turning points sit this far inside the surface's far
 *  and near edges (sprite rows from its top / bottom). */
const VERTICAL_BALL_TOP_INSET_PX = 8;
const VERTICAL_BALL_BOTTOM_INSET_PX = 14;
/** Z-sort nudge putting the ball after the table (zY = footprint bottom). */
const BALL_Z_AFTER_TABLE = 0.25;

export interface TableTennisTable {
  uid: string;
  slots: [PlaySlot, PlaySlot];
  /** Pixel position of the ball at slot 0's paddle and at slot 1's: the two
   *  turning points along the table's length (horizontal or vertical). */
  ballX0: number;
  ballY0: number;
  ballX1: number;
  ballY1: number;
  /** Z-sort key for the ball: just in front of the table, behind the players. */
  ballZY: number;
  /** Scoreboard anchor: above the net, over the table's sprite top. */
  scoreX: number;
  scoreY: number;
}

/**
 * Tables whose two end tiles are both usable: walkable and not somewhere an
 * idle agent may not stand (an Area or its buffer — Areas are for work only).
 * A wide table (the default orientation): slot 0 is left of it facing right,
 * slot 1 right of it facing left, both on the table's lower footprint row: the
 * table top is drawn raised, so its centre line sits over that row's ground
 * and a player standing there is level with the line, paddle at table height.
 * A tall (rotated) table: slot 0 is above it facing down, slot 1 below it
 * facing up, both in the table's left footprint column.
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
    const vertical = entry.footprintH > entry.footprintW;
    const end0 = vertical
      ? { col: item.col, row: item.row - 1 }
      : { col: item.col - 1, row: item.row + Math.floor(entry.footprintH / 2) };
    const end1 = vertical
      ? { col: item.col, row: item.row + entry.footprintH }
      : { col: item.col + entry.footprintW, row: end0.row };
    const ok = [end0, end1].every(
      (t) => isStandable(t.col, t.row) && !noIdleTileKeys.has(`${t.col},${t.row}`),
    );
    if (!ok) continue;
    const centerX = (item.col + entry.footprintW / 2) * TILE_SIZE;
    const ball = vertical
      ? {
          x0: centerX,
          y0: item.row * TILE_SIZE + VERTICAL_BALL_TOP_INSET_PX,
          x1: centerX,
          y1: (item.row + entry.footprintH) * TILE_SIZE - VERTICAL_BALL_BOTTOM_INSET_PX,
        }
      : {
          x0: end0.col * TILE_SIZE + TILE_SIZE / 2 + BALL_END_INSET_PX,
          y0: item.row * TILE_SIZE + TABLE_SURFACE_CENTER_PX,
          x1: end1.col * TILE_SIZE + TILE_SIZE / 2 - BALL_END_INSET_PX,
          y1: item.row * TILE_SIZE + TABLE_SURFACE_CENTER_PX,
        };
    tables.push({
      uid: item.uid,
      slots: [
        {
          tableUid: item.uid,
          index: 0,
          col: end0.col,
          row: end0.row,
          dir: vertical ? Direction.DOWN : Direction.RIGHT,
        },
        {
          tableUid: item.uid,
          index: 1,
          col: end1.col,
          row: end1.row,
          dir: vertical ? Direction.UP : Direction.LEFT,
        },
      ],
      ballX0: ball.x0,
      ballY0: ball.y0,
      ballX1: ball.x1,
      ballY1: ball.y1,
      ballZY: (item.row + entry.footprintH) * TILE_SIZE + BALL_Z_AFTER_TABLE,
      scoreX: centerX,
      scoreY:
        item.row * TILE_SIZE +
        entry.footprintH * TILE_SIZE -
        entry.sprite.length -
        TABLE_TENNIS_SCORE_LIFT_PX,
    });
  }
  return tables;
}

export interface TableGame {
  /** Seconds the one player at the table has waited for an opponent. */
  waited: number;
  /** Points per slot. */
  scores: [number, number];
  /** Which slot serves the current point. */
  server: 0 | 1;
  /** Table crossings this point's rally lasts (decided at the serve). */
  rallyHits: number;
  /** Seconds into the current rally. */
  elapsed: number;
  /** Seconds left of the breather before the next serve (0 = ball in play). */
  pause: number;
  /** Set once a player has won; the score stays up through the final pause. */
  winner: 0 | 1 | null;
}

function randomRallyHits(): number {
  const span = TABLE_TENNIS_RALLY_MAX_HITS - TABLE_TENNIS_RALLY_MIN_HITS + 1;
  return TABLE_TENNIS_RALLY_MIN_HITS + Math.floor(Math.random() * span);
}

export function newTableGame(): TableGame {
  return {
    waited: 0,
    scores: [0, 0],
    server: 0,
    rallyHits: randomRallyHits(),
    elapsed: 0,
    pause: TABLE_TENNIS_POINT_PAUSE_SEC,
    winner: null,
  };
}

/** The winner of a game at this score (to 11, win by 2), or null. */
export function gameWinner(scores: readonly [number, number]): 0 | 1 | null {
  const [a, b] = scores;
  if (Math.max(a, b) < TABLE_TENNIS_WIN_POINTS || Math.abs(a - b) < TABLE_TENNIS_WIN_BY) {
    return null;
  }
  return a > b ? 0 : 1;
}

/** Who serves next: turns of two points, one each once both reach deuce. */
export function nextServer(scores: readonly [number, number]): 0 | 1 {
  const played = scores[0] + scores[1];
  const deuce = TABLE_TENNIS_WIN_POINTS - 1;
  if (scores[0] >= deuce && scores[1] >= deuce) return (played % 2) as 0 | 1;
  return (Math.floor(played / TABLE_TENNIS_SERVES_PER_TURN) % 2) as 0 | 1;
}

/** Award a point (random winner when none is given) and set up the next one. */
export function scorePoint(game: TableGame, winner: 0 | 1 = Math.random() < 0.5 ? 0 : 1): void {
  game.scores[winner] += 1;
  game.elapsed = 0;
  game.winner = gameWinner(game.scores);
  game.pause =
    game.winner === null ? TABLE_TENNIS_POINT_PAUSE_SEC : TABLE_TENNIS_GAME_OVER_PAUSE_SEC;
  game.server = nextServer(game.scores);
  game.rallyHits = randomRallyHits();
}

function resetTableGame(game: TableGame): void {
  Object.assign(game, newTableGame(), { waited: game.waited });
}

/** What the table needs done after a tick. */
export type TableVerdict = 'empty' | 'waiting' | 'playing' | 'give-up' | 'finished';

/**
 * Advance a table's game by dt given how many players stand at their ends.
 * 'playing' covers rallies and the breathers between points; 'give-up' /
 * 'finished' tell the caller to send the players off (the game is reset).
 */
export function advanceTableGame(game: TableGame, arrived: number, dt: number): TableVerdict {
  if (arrived < 2) {
    resetTableGame(game);
    if (arrived === 0) {
      game.waited = 0;
      return 'empty';
    }
    game.waited += dt;
    if (game.waited >= TABLE_TENNIS_WAIT_MAX_SEC) {
      game.waited = 0;
      return 'give-up';
    }
    return 'waiting';
  }
  game.waited = 0;
  if (game.pause > 0) {
    game.pause -= dt;
    if (game.pause > 0) return 'playing';
    game.pause = 0;
    if (game.winner !== null) {
      resetTableGame(game);
      return 'finished';
    }
    return 'playing';
  }
  game.elapsed += dt;
  if (game.elapsed >= game.rallyHits * TABLE_TENNIS_BALL_CROSS_SEC) scorePoint(game);
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

/** The ball at a rally time: hit back and forth, `server` hitting first. */
export function tableBall(table: TableTennisTable, elapsed: number, server: 0 | 1 = 0): TableBall {
  const phase = elapsed / TABLE_TENNIS_BALL_CROSS_SEC;
  const leg = Math.floor(phase);
  const u = phase - leg;
  const fromSlot0 = (leg % 2 === 0) === (server === 0);
  const t = fromSlot0 ? u : 1 - u; // 0 at slot 0's paddle, 1 at slot 1's
  return {
    x: table.ballX0 + (table.ballX1 - table.ballX0) * t,
    y: table.ballY0 + (table.ballY1 - table.ballY0) * t,
    z: ballHeight(u),
    zY: table.ballZY,
    near: [1 - t, t],
  };
}

/** Swing frame (1) while the ball is at this player's paddle, else ready (0). */
export function swingFrame(nearness: number): 0 | 1 {
  return nearness >= 1 - TABLE_TENNIS_SWING_NEAR ? 1 : 0;
}

/** A scoreboard to draw: the two scores, left player first, over the net. */
export interface TableScore {
  x: number;
  y: number;
  scores: [number, number];
  winner: 0 | 1 | null;
}

/** The ball in play, or null between points. */
export function ballInPlay(table: TableTennisTable, game: TableGame): TableBall | null {
  return game.pause > 0 ? null : tableBall(table, game.elapsed, game.server);
}
