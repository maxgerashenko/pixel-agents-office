import {
  DEFAULT_MAX_CONTEXT_TOKENS,
  PLAY_MAX_SEC,
  PLAY_MIN_SEC,
  SEAT_REST_MAX_SEC,
  SEAT_REST_MIN_SEC,
  TYPE_FRAME_DURATION_SEC,
  WALK_FRAME_DURATION_SEC,
  WALK_SPEED_PX_PER_SEC,
  WANDER_MOVES_BEFORE_REST_MAX,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_PAUSE_MAX_SEC,
  WANDER_PAUSE_MIN_SEC,
  WORK_SPOT_RECHECK_SEC,
} from '../../constants.js';
import { findPath } from '../layout/tileMap.js';
import type { CharacterSprites } from '../sprites/spriteData.js';
import { isReadingToolName } from '../toolUtils.js';
import type {
  Character,
  PlaySlot,
  Seat,
  SpriteData,
  TileType as TileTypeVal,
  WorkSpot,
} from '../types.js';
import { CharacterState, Direction, TILE_SIZE } from '../types.js';

/** Whether a tool should show the reading animation (vs typing). Taxonomy comes
 *  from the active HookProvider via the `providerCapabilities` message. */
export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false;
  return isReadingToolName(tool);
}

/**
 * Plans an agent's way to work when it has no reachable work seat of its own:
 * a free computer first, else a pairing seat, else a phone spot in its Area.
 * Sets the claim and starts the walk (or settles in place); returns false when
 * nothing at all could be planned. With `betterThan`, only spots ranked above
 * that kind are considered (computer > pair > phone) and false means "stay".
 */
export type ClaimWorkSpot = (ch: Character, betterThan?: WorkSpot['kind']) => boolean;

/**
 * Plans a bored idle agent's way to a table-tennis table: claims a free end,
 * sets `playSlot` and starts the walk (or settles in place). Returns false
 * when no table is worth going to, so the agent rests or wanders instead.
 */
export type ClaimTable = (ch: Character) => boolean;
/** A standing spot in front of an arcade machine, where an idle agent plays. */
export interface PlaySpot {
  col: number;
  row: number;
  /** Direction to face (towards the machine). */
  dir: Direction;
}

/** Drawn sitting: on a chair (work seat, pairing seat, rest seat), not standing. */
export function isSeatedPose(ch: Character): boolean {
  if (ch.state !== CharacterState.TYPE) return false;
  if (ch.playSlot || ch.playSpotId) return false; // playing stands at the table / machine
  if (ch.restSeatId) return true;
  if (ch.workSpot) return ch.workSpot.kind === 'pair';
  return ch.seatId !== null;
}

/** Vibe coding on the phone: a working agent on its way to work, or one that
 *  works standing because no computer or pairing seat was free. */
export function isOnPhone(ch: Character): boolean {
  if (!ch.isActive || ch.isGreeter) return false;
  if (ch.state === CharacterState.WALK) return true;
  return ch.state === CharacterState.TYPE && !isSeatedPose(ch);
}

/** Start walking along a path (no-op state reset shared by every walk). */
function startWalk(ch: Character, path: Array<{ col: number; row: number }>): void {
  ch.path = path;
  ch.moveProgress = 0;
  ch.state = CharacterState.WALK;
  ch.frame = 0;
  ch.frameTimer = 0;
}

/** Settle on a claimed work spot: sit on the pairing seat, or stand and phone. */
export function settleOnWorkSpot(ch: Character, spot: WorkSpot): void {
  ch.state = CharacterState.TYPE;
  ch.dir = spot.dir;
  ch.frame = 0;
  ch.frameTimer = 0;
  ch.workSpotRecheck = WORK_SPOT_RECHECK_SEC;
}

/** Arrive at a table end: stand facing the opponent's end, waiting for a rally. */
export function settleAtPlaySlot(ch: Character, slot: PlaySlot): void {
  ch.state = CharacterState.TYPE;
  ch.dir = slot.dir;
  ch.playing = false;
  ch.frame = 0;
  ch.frameTimer = 0;
  ch.wanderCount = 0;
  ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
}

/** Leave the table: back to idling (and wandering) with the claim released. */
export function leaveTable(ch: Character): void {
  ch.playSlot = null;
  ch.playing = false;
  if (ch.state === CharacterState.TYPE) {
    ch.state = CharacterState.IDLE;
    ch.seatTimer = 0;
    ch.frame = 0;
    ch.frameTimer = 0;
    ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    ch.wanderCount = 0;
    ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX);
  }
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

/**
 * Claim a free play spot at an arcade machine and walk there. Same contract as
 * goRest: claims leave `freePlaySpots` so two agents can't pick one machine.
 */
function goPlay(
  ch: Character,
  playSpots: Map<string, PlaySpot>,
  freePlaySpots: Set<string>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): boolean {
  const candidates = [...freePlaySpots];
  while (candidates.length > 0) {
    const [id] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
    const spot = playSpots.get(id);
    if (!spot) continue;
    if (ch.tileCol === spot.col && ch.tileRow === spot.row) {
      freePlaySpots.delete(id);
      ch.playSpotId = id;
      startPlaying(ch, spot);
      return true;
    }
    const path = findPath(ch.tileCol, ch.tileRow, spot.col, spot.row, tileMap, blockedTiles);
    if (path.length === 0) continue;
    freePlaySpots.delete(id);
    ch.playSpotId = id;
    ch.path = path;
    ch.moveProgress = 0;
    ch.state = CharacterState.WALK;
    ch.frame = 0;
    ch.frameTimer = 0;
    return true;
  }
  return false;
}

/** Face the machine and work its buttons (the typing frames, standing). */
function startPlaying(ch: Character, spot: PlaySpot): void {
  ch.state = CharacterState.TYPE;
  ch.dir = spot.dir;
  ch.seatTimer = randomRange(PLAY_MIN_SEC, PLAY_MAX_SEC);
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
 *   its 1-tile buffer, since idle agents never linger there. Also governs
 *   arrival at that seat while idle (e.g. the user sent it there): when false
 *   the agent sits down for no rest at all (seatTimer 0) and walks straight out.
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
  claimWorkSpot?: ClaimWorkSpot,
  claimTable?: ClaimTable,
  playSpots: Map<string, PlaySpot> = new Map(),
  freePlaySpots: Set<string> = new Set(),
): void {
  ch.frameTimer += dt;

  // Work beats play too: drop the table claim the moment the agent is active
  if (ch.isActive && ch.playSlot) {
    leaveTable(ch);
  }

  // Work is over: give the pairing seat / phone spot up. A phone agent was
  // standing, so it goes straight back to idling (and out of the Area).
  if (!ch.isActive && ch.workSpot) {
    ch.workSpot = null;
    if (ch.state === CharacterState.TYPE) {
      ch.state = CharacterState.IDLE;
      ch.seatTimer = 0;
      ch.frame = 0;
      ch.frameTimer = 0;
      ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
    }
  }

  // Work always beats rest and play: an agent that became active gives up its
  // rest seat / play spot and the normal active path takes over.
  if (ch.isActive && ch.playSpotId) {
    ch.playSpotId = null;
    if (ch.state === CharacterState.TYPE) {
      ch.state = CharacterState.IDLE;
      ch.seatTimer = 0;
    }
  }
  if (ch.isActive && ch.restSeatId) {
    ch.restSeatId = null;
    if (ch.state === CharacterState.TYPE) {
      ch.state = CharacterState.IDLE;
      ch.seatTimer = 0;
    }
  }

  switch (ch.state) {
    case CharacterState.TYPE: {
      if (ch.playSlot) {
        // At a table end: officeState drives the swing frame from the ball
        // while a rally is on; waiting for an opponent is the ready pose
        if (!ch.playing) ch.frame = 0;
        break;
      }
      if (ch.playSpotId) {
        // Playing at an arcade machine: button-mash until the timer runs out
        if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
          ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
          ch.frame = (ch.frame + 1) % 2;
        }
        ch.seatTimer -= dt;
        if (ch.seatTimer <= 0) {
          ch.playSpotId = null;
          ch.seatTimer = 0;
          ch.state = CharacterState.IDLE;
          ch.frame = 0;
          ch.frameTimer = 0;
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
        }
        break;
      }
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
      // Working, but not at a computer or a claimed spot (e.g. it was standing
      // when the turn started): plan the way to work instead of typing in the air
      if (ch.isActive && !ch.workSpot && claimWorkSpot) {
        const seat = ch.seatId ? seats.get(ch.seatId) : undefined;
        if (!seat || ch.tileCol !== seat.seatCol || ch.tileRow !== seat.seatRow) {
          ch.state = CharacterState.IDLE;
          ch.frame = 0;
          ch.frameTimer = 0;
          break;
        }
      }
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC;
        ch.frame = (ch.frame + 1) % 2;
      }
      // Pairing or phoning: keep an eye out for a computer that came free
      if (ch.isActive && ch.workSpot && claimWorkSpot) {
        ch.workSpotRecheck = (ch.workSpotRecheck ?? WORK_SPOT_RECHECK_SEC) - dt;
        if (ch.workSpotRecheck <= 0) {
          ch.workSpotRecheck = WORK_SPOT_RECHECK_SEC;
          if (claimWorkSpot(ch, ch.workSpot.kind)) break;
        }
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
      // Became active: head to work (own computer, else claim a spot)
      if (ch.isActive) {
        startWork(ch, seats, tileMap, blockedTiles, claimWorkSpot);
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
        // Wandered enough — play table tennis, else play at an arcade machine or
        // rest on a bench/sofa (coin flip, the other as fallback), else back at
        // the work seat
        if (ch.wanderCount >= ch.wanderLimit && claimTable?.(ch)) {
          break;
        }
        if (ch.wanderCount >= ch.wanderLimit) {
          const play = () => goPlay(ch, playSpots, freePlaySpots, tileMap, blockedTiles);
          const rest = () => goRest(ch, seats, freeRestSeats, tileMap, blockedTiles);
          if (Math.random() < 0.5 ? play() || rest() : rest() || play()) break;
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
          const spot = ch.workSpot;
          const seat = ch.seatId ? seats.get(ch.seatId) : undefined;
          if (spot && ch.tileCol === spot.col && ch.tileRow === spot.row) {
            settleOnWorkSpot(ch, spot);
            break;
          } else if (!spot && seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
            ch.state = CharacterState.TYPE;
            ch.dir = seat.facingDir;
          } else if (!spot && !seat && !claimWorkSpot) {
            // Nowhere to go (sub-agents) — work in place
            ch.state = CharacterState.TYPE;
          } else {
            // Not there yet: the IDLE branch plans the way to work
            ch.state = CharacterState.IDLE;
          }
        } else {
          // Arrived at a claimed table end — stand and wait for the game
          if (ch.playSlot) {
            const slot = ch.playSlot;
            if (ch.tileCol === slot.col && ch.tileRow === slot.row) {
              settleAtPlaySlot(ch, slot);
              break;
            }
            ch.playSlot = null; // path ended elsewhere — give the claim up
          }
          // Arrived at a claimed arcade machine — start playing
          if (ch.playSpotId) {
            const spot = playSpots.get(ch.playSpotId);
            if (spot && ch.tileCol === spot.col && ch.tileRow === spot.row) {
              startPlaying(ch, spot);
              break;
            }
            ch.playSpotId = null; // path ended elsewhere — give the claim up
          }
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
              // Same for a seat in an Area or its buffer: idle agents never sit out
              // a rest there, so stand straight back up and leave.
              if (ch.seatTimer < 0 || !canRestAtWorkSeat) {
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

      // If became active while wandering, repath to the work spot / seat
      if (ch.isActive) {
        const seat = ch.seatId ? seats.get(ch.seatId) : undefined;
        const target = ch.workSpot
          ? { col: ch.workSpot.col, row: ch.workSpot.row }
          : seat
            ? { col: seat.seatCol, row: seat.seatRow }
            : null;
        if (target) {
          const lastStep = ch.path[ch.path.length - 1];
          if (!lastStep || lastStep.col !== target.col || lastStep.row !== target.row) {
            const newPath = findPath(
              ch.tileCol,
              ch.tileRow,
              target.col,
              target.row,
              tileMap,
              blockedTiles,
            );
            if (newPath.length > 0) {
              ch.path = newPath;
              ch.moveProgress = 0;
            }
          }
        } else if (claimWorkSpot && ch.path.length > 1) {
          // No seat or spot yet: finish this step, then the IDLE branch plans
          ch.path = ch.path.slice(0, 1);
        }
      }
      break;
    }
  }
}

/**
 * An active agent heads to work. A claimed work spot wins (walk there, or
 * settle when already on it); otherwise its own work seat; otherwise — no
 * seat, or no way to it — `claimWorkSpot` plans one. When even that finds
 * nothing the agent vibe codes on its phone where it stands, never "types"
 * standing in the air. Agents without a planner (sub-agents) work in place.
 */
function startWork(
  ch: Character,
  seats: Map<string, Seat>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  claimWorkSpot: ClaimWorkSpot | undefined,
): void {
  const spot = ch.workSpot;
  if (spot) {
    if (ch.tileCol === spot.col && ch.tileRow === spot.row) {
      settleOnWorkSpot(ch, spot);
      return;
    }
    const path = findPath(ch.tileCol, ch.tileRow, spot.col, spot.row, tileMap, blockedTiles);
    if (path.length > 0) {
      startWalk(ch, path);
      return;
    }
    ch.workSpot = null; // unreachable now — plan again below
  }
  const seat = ch.seatId ? seats.get(ch.seatId) : undefined;
  if (seat) {
    if (ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
      ch.frame = 0;
      ch.frameTimer = 0;
      return;
    }
    const path = findPath(
      ch.tileCol,
      ch.tileRow,
      seat.seatCol,
      seat.seatRow,
      tileMap,
      blockedTiles,
    );
    if (path.length > 0) {
      startWalk(ch, path);
      return;
    }
  }
  if (claimWorkSpot) {
    if (claimWorkSpot(ch)) return;
    const here: WorkSpot = { kind: 'phone', col: ch.tileCol, row: ch.tileRow, dir: ch.dir };
    ch.workSpot = here;
    settleOnWorkSpot(ch, here);
    return;
  }
  // No planner (sub-agents): work in place
  ch.state = CharacterState.TYPE;
  ch.frame = 0;
  ch.frameTimer = 0;
}

/** Get the correct sprite frame for a character's current state and direction */
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  switch (ch.state) {
    case CharacterState.TYPE:
      // Table tennis: paddle ready, or swinging as the ball arrives
      if (ch.playSlot) return sprites.paddle[ch.dir][ch.playing ? ch.frame % 2 : 0];
      if (isOnPhone(ch)) return sprites.phone[ch.dir][ch.frame % 2];
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2];
      }
      return sprites.typing[ch.dir][ch.frame % 2];
    case CharacterState.WALK:
      if (isOnPhone(ch)) return sprites.phoneWalk[ch.dir][ch.frame % 4];
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
