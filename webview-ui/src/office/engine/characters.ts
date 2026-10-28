import {
  DEFAULT_MAX_CONTEXT_TOKENS,
  SEAT_REST_MAX_SEC,
  SEAT_REST_MIN_SEC,
  TYPE_FRAME_DURATION_SEC,
  WALK_FRAME_DURATION_SEC,
  WALK_SPEED_PX_PER_SEC,
  WANDER_MOVES_BEFORE_REST_MAX,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_PAUSE_MAX_SEC,
  WANDER_PAUSE_MIN_SEC,
} from '../../constants.js';
import { findPath } from '../layout/tileMap.js';
import type { CharacterSprites } from '../sprites/spriteData.js';
import { isReadingToolName } from '../toolUtils.js';
import type { Character, Seat, SpriteData, TileType as TileTypeVal } from '../types.js';
import { CharacterState, Direction, TILE_SIZE } from '../types.js';

/** Whether a tool should show the reading animation (vs typing). Taxonomy comes
 *  from the active HookProvider via the `providerCapabilities` message. */
export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false;
  return isReadingToolName(tool);
}

/** Pixel center of a tile */
function tileCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Direction from one tile to an adjacent tile */
function directionBetween(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): Direction {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  if (dc > 0) return Direction.RIGHT;
  if (dc < 0) return Direction.LEFT;
  if (dr > 0) return Direction.DOWN;
  return Direction.UP;
}

export function createCharacter(
  id: number,
  palette: number,
  seatId: string | null,
  seat: Seat | null,
  hueShift = 0,
): Character {
  const col = seat ? seat.seatCol : 1;
  const row = seat ? seat.seatRow : 1;
  const center = tileCenter(col, row);
  return {
    id,
    state: CharacterState.TYPE,
    dir: seat ? seat.facingDir : Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette,
    hueShift,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX),
    isActive: true,
    seatId,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    isSubagent: false,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    contextTokens: 0,
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
  };
}

/**
 * Claim a free rest seat (bench/sofa) and start walking to it. Rest seats are
 * chair tiles, so they sit in `blockedTiles`; the claimed one is unblocked for
 * this one query, like an agent's own work seat. Claims are removed from
 * `freeRestSeats` so two agents updated in the same frame can't pick the same
 * seat. Returns false (claiming nothing) when no free rest seat is reachable.
 */
function goRest(
  ch: Character,
  seats: Map<string, Seat>,
  freeRestSeats: Set<string>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): boolean {
  const candidates = [...freeRestSeats];
  while (candidates.length > 0) {
    const [uid] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
    const seat = seats.get(uid);
    if (!seat) continue;
    if (ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
      freeRestSeats.delete(uid);
      ch.restSeatId = uid;
      sitToRest(ch, seat);
      return true;
    }
    const key = `${seat.seatCol},${seat.seatRow}`;
    const wasBlocked = blockedTiles.delete(key);
    const path = findPath(
      ch.tileCol,
      ch.tileRow,
      seat.seatCol,
      seat.seatRow,
      tileMap,
      blockedTiles,
    );
    if (wasBlocked) blockedTiles.add(key);
    if (path.length === 0) continue;
    freeRestSeats.delete(uid);
    ch.restSeatId = uid;
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }
  return false;
}

/** Sit down on a rest seat: the seated pose without the typing animation. */
function sitToRest(ch: Character, seat: Seat): void {
  ch.state = CharacterState.TYPE;
  ch.dir = seat.facingDir;
  ch.seatTimer = randomRange(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC);
  ch.wanderCount = 0;
  ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
  ch.frame = 0;
  ch.frameTimer = 0;
}

/** Max candidate tiles tried when leaving the Area buffer (nearest first). */
const LEAVE_BUFFER_MAX_ATTEMPTS = 5;

/**
 * Walk an idle character off a tile it may not idle on, to the nearest allowed
 * tile (Manhattan, then pathfound; the next-nearest if unreachable). Returns
 * whether a walk started.
 */
function leaveBuffer(
  ch: Character,
  wanderTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): boolean {
  const dist = (t: { col: number; row: number }) =>
    Math.abs(t.col - ch.tileCol) + Math.abs(t.row - ch.tileRow);
  const nearest = wanderTiles
    .map((t) => ({ t, d: dist(t) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, LEAVE_BUFFER_MAX_ATTEMPTS);
  for (const { t } of nearest) {
    const path = findPath(ch.tileCol, ch.tileRow, t.col, t.row, tileMap, blockedTiles);
    if (path.length > 0) {
      ch.path = path;
      ch.moveProgress = 0;
      ch.state = CharacterState.WALK;
      ch.frame = 0;
      ch.frameTimer = 0;
      return true;
    }
  }
  return false;
}

/**
 * Advance one character's FSM.
 *
 * @param wanderTiles Tiles an idle agent may wander to — the office outside
 *   every marked Area and its 1-tile buffer (Areas are for work only).
 * @param freeRestSeats Unclaimed rest seats (benches/sofas). Mutated: a claim
 *   removes its seat.
 * @param canRestAtWorkSeat Whether an idle agent with no free rest seat may sit
 *   out its rest at its own work seat — false when that seat is in an Area or
 *   its 1-tile buffer, since idle agents never linger there.
 * @param noIdleTileKeys "col,row" keys of the tiles idle agents may not stay
 *   on (an Area and its buffer). An idle (not active) character standing on one
 *   skips the wander pause and walks straight to the nearest wander tile.
 */
export function updateCharacter(
  ch: Character,
  dt: number,
  wanderTiles: Array<{ col: number; row: number }>,
  seats: Map<string, Seat>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  freeRestSeats: Set<string> = new Set(),
  canRestAtWorkSeat = true,
  noIdleTileKeys: ReadonlySet<string> = new Set(),
): void {
  ch.frameTimer += dt;

  // Work always beats rest: an agent that became active gives up its rest seat
  // and the normal active path (IDLE -> walk to work seat) takes over.
  if (ch.isActive && ch.restSeatId) {
    ch.restSeatId = null;
    if (ch.state === CharacterState.TYPE) {
      ch.state = CharacterState.IDLE;
      ch.seatTimer = 0;
    }
  }

  switch (ch.state) {
    case CharacterState.TYPE: {
      if (ch.restSeatId) {
        // Resting on a bench/sofa: sit still until the rest timer runs out
        ch.frame = 0;
        ch.seatTimer -= dt;
        if (ch.seatTimer <= 0) {
          ch.restSeatId = null;
          ch.seatTimer = 0;
          ch.state = CharacterState.IDLE;
          ch.frameTimer = 0;
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        }
        break;
      }
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 2;
      }
      // If no longer active, stand up and start wandering (after seatTimer expires)
      if (!ch.isActive) {
        if (ch.seatTimer > 0) {
          ch.seatTimer -= dt;
          break;
        }
        ch.seatTimer = 0; // clear sentinel
        ch.state = CharacterState.IDLE;
        ch.frame = 0;
        ch.frameTimer = 0;
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        ch.wanderCount = 0;
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
      }
      break;
    }

    case CharacterState.IDLE: {
      // No idle animation — static pose
      ch.frame = 0;
      if (ch.seatTimer < 0) ch.seatTimer = 0; // clear turn-end sentinel
      // If became active, pathfind to seat
      if (ch.isActive) {
        if (!ch.seatId) {
          // No seat assigned — type in place
          ch.state = CharacterState.TYPE;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
        const seat = seats.get(ch.seatId);
        if (seat) {
          const path = findPath(
            ch.tileCol,
            ch.tileRow,
            seat.seatCol,
            seat.seatRow,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
          } else {
            // Already at seat or no path — sit down
            ch.state = CharacterState.TYPE;
            ch.dir = seat.facingDir;
            ch.frame = 0;
            ch.frameTimer = 0;
          }
        }
        break;
      }
      // Standing in an Area or its buffer: leave now instead of after the pause
      if (
        !ch.isActive &&
        noIdleTileKeys.has(`${ch.tileCol},${ch.tileRow}`) &&
        leaveBuffer(ch, wanderTiles, tileMap, blockedTiles)
      ) {
        break;
      }
      // Countdown wander timer
      ch.wanderTimer -= dt;
      if (ch.wanderTimer <= 0) {
        // Wandered enough — rest on a bench/sofa, else back at the work seat
        if (
          ch.wanderCount >= ch.wanderLimit &&
          goRest(ch, seats, freeRestSeats, tileMap, blockedTiles)
        ) {
          break;
        }
        if (ch.wanderCount >= ch.wanderLimit && ch.seatId && canRestAtWorkSeat) {
          const seat = seats.get(ch.seatId);
          if (seat) {
            const path = findPath(
              ch.tileCol,
              ch.tileRow,
              seat.seatCol,
              seat.seatRow,
              tileMap,
              blockedTiles,
            );
            if (path.length > 0) {
              ch.path = path;
              ch.moveProgress = 0;
              ch.state = CharacterState.WALK;
              ch.frame = 0;
              ch.frameTimer = 0;
              break;
            }
          }
        }
        if (wanderTiles.length > 0) {
          const target = wanderTiles[Math.floor(Math.random() * wanderTiles.length)];
          const path = findPath(
            ch.tileCol,
            ch.tileRow,
            target.col,
            target.row,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
            ch.wanderCount++;
          }
        }
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case CharacterState.WALK: {
      // Walk animation
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 4;
      }

      if (ch.path.length === 0) {
        // Path complete — snap to tile center and transition
        const center = tileCenter(ch.tileCol, ch.tileRow);
        ch.x = center.x;
        ch.y = center.y;

        if (ch.isActive) {
          if (!ch.seatId) {
            // No seat — type in place
            ch.state = CharacterState.TYPE;
          } else {
            const seat = seats.get(ch.seatId);
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE;
              ch.dir = seat.facingDir;
            } else {
              ch.state = CharacterState.IDLE;
            }
          }
        } else {
          // Arrived at a claimed rest seat — sit down and rest
          if (ch.restSeatId) {
            const restSeat = seats.get(ch.restSeatId);
            if (restSeat && ch.tileCol === restSeat.seatCol && ch.tileRow === restSeat.seatRow) {
              sitToRest(ch, restSeat);
              break;
            }
            ch.restSeatId = null; // path ended elsewhere — give the claim up
          }
          // Check if arrived at assigned seat — sit down for a rest before wandering again
          if (ch.seatId) {
            const seat = seats.get(ch.seatId);
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE;
              ch.dir = seat.facingDir;
              // seatTimer < 0 is a sentinel from setAgentActive(false) meaning
              // "turn just ended" — skip the long rest so idle transition is immediate
              if (ch.seatTimer < 0) {
                ch.seatTimer = 0;
              } else {
                ch.seatTimer = randomRange(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC);
              }
              ch.wanderCount = 0;
              ch.wanderLimit = randomInt(
                WANDER_MOVES_BEFORE_REST_MIN,
                WANDER_MOVES_BEFORE_REST_MAX,
              );
              ch.frame = 0;
              ch.frameTimer = 0;
              break;
            }
          }
          ch.state = CharacterState.IDLE;
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        }
        ch.frame = 0;
        ch.frameTimer = 0;
        break;
      }

      // Move toward next tile in path
      const nextTile = ch.path[0];
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row);

      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;

      const fromCenter = tileCenter(ch.tileCol, ch.tileRow);
      const toCenter = tileCenter(nextTile.col, nextTile.row);
      const t = Math.min(ch.moveProgress, 1);
      ch.x = fromCenter.x + (toCenter.x - fromCenter.x) * t;
      ch.y = fromCenter.y + (toCenter.y - fromCenter.y) * t;

      if (ch.moveProgress >= 1) {
        // Arrived at next tile
        ch.tileCol = nextTile.col;
        ch.tileRow = nextTile.row;
        ch.x = toCenter.x;
        ch.y = toCenter.y;
        ch.path.shift();
        ch.moveProgress = 0;
      }

      // If became active while wandering, repath to seat
      if (ch.isActive && ch.seatId) {
        const seat = seats.get(ch.seatId);
        if (seat) {
          const lastStep = ch.path[ch.path.length - 1];
          if (!lastStep || lastStep.col !== seat.seatCol || lastStep.row !== seat.seatRow) {
            const newPath = findPath(
              ch.tileCol,
              ch.tileRow,
              seat.seatCol,
              seat.seatRow,
              tileMap,
              blockedTiles,
            );
            if (newPath.length > 0) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }
          }
        }
      }
      break;
    }
  }
}

/** Get the correct sprite frame for a character's current state and direction */
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  switch (ch.state) {
    case CharacterState.TYPE:
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2];
      }
      return sprites.typing[ch.dir][ch.frame % 2];
    case CharacterState.WALK:
      return sprites.walk[ch.dir][ch.frame % 4];
    case CharacterState.IDLE:
      return sprites.walk[ch.dir][1];
    default:
      return sprites.walk[ch.dir][1];
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
