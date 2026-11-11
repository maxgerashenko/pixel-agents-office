import {
  CHARACTER_Z_SORT_OFFSET,
  PET_BITE_CHANCE,
  PET_BITE_COOLDOWN_SEC,
  PET_BITE_DRAG_HOLD_SEC,
  PET_BITE_DRAG_TILES,
  PET_BITE_RADIUS_TILES,
  PET_BITE_REACH_PX,
  PET_BITE_SIDE_OFFSET_PX,
  PET_BITE_TRAIL_PX,
  PET_CAT_TREE_CHANCE,
  PET_CHASE_MAX_SEC,
  PET_CHASE_RECALC_INTERVAL_SEC,
  PET_CHASE_SPEED_PX_PER_SEC,
  PET_FOLLOW_CHANCE,
  PET_FOLLOW_DURATION_MAX_SEC,
  PET_FOLLOW_DURATION_MIN_SEC,
  PET_FOLLOW_RADIUS_TILES,
  PET_FOLLOW_RECALC_INTERVAL_SEC,
  PET_HOME_RADIUS_TILES,
  PET_HOME_TABLE_PATTERNS,
  PET_HOP_ARC_PX,
  PET_HOP_DURATION_SEC,
  PET_IDLE_FRAME_DURATION_SEC,
  PET_IDLE_SEQUENCE,
  PET_LAP_CHANCE,
  PET_LAP_SIDE_SHIFT_PX,
  PET_LAP_Y_OFFSET_PX,
  PET_PERCH_CHANCE,
  PET_PERCH_DURATION_MAX_SEC,
  PET_PERCH_DURATION_MIN_SEC,
  PET_PERCH_SEATED_RADIUS_TILES,
  PET_PERCH_STANDING_RADIUS_TILES,
  PET_SEAT_SEARCH_RADIUS_TILES,
  PET_SOFA_CHANCE,
  PET_WALK_FRAME_DURATION_SEC,
  PET_WALK_SEQUENCE,
  PET_WALK_SPEED_PX_PER_SEC,
  PET_WANDER_PAUSE_MAX_SEC,
  PET_WANDER_PAUSE_MIN_SEC,
} from '../../constants.js';
import { findPath, isWalkable } from '../layout/tileMap.js';
import type { PetSpriteFrames } from '../sprites/petSpriteData.js';
import type {
  Character,
  Pet,
  PetPerchTarget,
  PlacedFurniture,
  SpriteData,
  TileType as TileTypeVal,
} from '../types.js';
import { CharacterState, Direction, PetKind, PetState, TILE_SIZE } from '../types.js';
import { isSeatedPose } from './characters.js';

/** The tile the pet stays around, and how far (Manhattan tiles) it may roam from it. */
export interface PetHome {
  col: number;
  row: number;
  radius: number;
  /** The table's tiles. */
  footprint: { col: number; row: number; w: number; h: number };
  /**
   * Where the cat sits when it jumps up (pixel feet position) and the depth key
   * to draw it with. Absent when something (a PC) stands on the table.
   */
  perch?: { x: number; y: number; zY: number };
}

/** What `findPetHome` needs to know about a furniture type. */
export interface PetFurnitureInfo {
  w: number;
  h: number;
  /** Item stands on desks (PC, monitor, mug…), so it occupies the table top. */
  onSurface?: boolean;
}

/** A free sofa seat a dog may jump onto (derived by OfficeState each tick). */
export interface PetSofaSpot {
  /** The seat's key in OfficeState.seats. */
  seatId: string;
  col: number;
  row: number;
  /** Where the dog stands on the cushion (pixel feet position) and its depth key. */
  x: number;
  y: number;
  zY: number;
}

/** A cat tree a cat may climb (derived by OfficeState each tick). */
export interface PetTreeSpot {
  /** The placed furniture's uid. */
  uid: string;
  /** The tree's tiles. */
  footprint: { col: number; row: number; w: number; h: number };
  /** Where the cat sits on the top platform (pixel feet position) and its depth key. */
  x: number;
  y: number;
  zY: number;
}

/** What the pet can see beyond the characters: free sofas and trees, and what other pets took. */
export interface PetSurroundings {
  sofas: readonly PetSofaSpot[];
  trees: readonly PetTreeSpot[];
  /** `perchKey`s / `bite:<id>` already taken by OTHER pets. */
  claimed: ReadonlySet<string>;
}

const NO_SURROUNDINGS: PetSurroundings = { sofas: [], trees: [], claimed: new Set() };

/** A resolved perch: where to sit, its depth key, and the tiles to jump up from. */
interface PerchSpot {
  x: number;
  y: number;
  zY: number;
  footprint: { col: number; row: number; w: number; h: number };
}

/** Unique key of a perch, so two pets never pick the same sofa seat or lap. */
export function perchKey(target: PetPerchTarget): string {
  if (target.kind === 'sofa') return `sofa:${target.seatId}`;
  if (target.kind === 'lap') return `lap:${target.charId}`;
  if (target.kind === 'tree') return `tree:${target.uid}`;
  return 'table';
}

/** The keys this pet holds (its perch, or the agent it chases / bites). */
export function petClaims(pet: Pet): string[] {
  const keys: string[] = [];
  if (pet.perchTarget && pet.perchTarget.kind !== 'table') keys.push(perchKey(pet.perchTarget));
  if ((pet.chaseToBite || pet.state === PetState.BITE) && pet.followTargetId !== null) {
    keys.push(`bite:${pet.followTargetId}`);
  }
  return keys;
}

/**
 * Where a cat sits on a seated agent's lap, or null when the agent is not
 * sitting (or sits with its back to us, which would hide the cat).
 */
export function lapSpot(ch: Character | undefined): PerchSpot | null {
  if (!ch || ch.matrixEffect === 'despawn' || ch.isSubagent) return null;
  if (!isSeatedPose(ch) || ch.dir === Direction.UP) return null;
  const shift =
    ch.dir === Direction.LEFT
      ? -PET_LAP_SIDE_SHIFT_PX
      : ch.dir === Direction.RIGHT
        ? PET_LAP_SIDE_SHIFT_PX
        : 0;
  return {
    x: ch.x + shift,
    y: ch.y + PET_LAP_Y_OFFSET_PX,
    // Just in front of the agent, so the cat covers the lap
    zY: ch.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET + 0.1,
    footprint: { col: ch.tileCol, row: ch.tileRow, w: 1, h: 1 },
  };
}

/** Whether a tile is within the pet's seat-search range (from its table, else from the pet). */
function withinSeatSearch(pet: Pet, home: PetHome | null, col: number, row: number): boolean {
  const from = home ?? { col: pet.tileCol, row: pet.tileRow };
  return manhattanDistance(from.col, from.row, col, row) <= PET_SEAT_SEARCH_RADIUS_TILES;
}

/**
 * Pick the table the pet hangs out at: the first placed item matching the
 * highest-priority entry of PET_HOME_TABLE_PATTERNS (table tennis, then any
 * table). `footprintOf` supplies the item's size; the home is its centre tile.
 * Returns null when the office has no table, so the pet roams freely.
 */
export function findPetHome(
  furniture: readonly PlacedFurniture[],
  infoOf: (type: string) => PetFurnitureInfo | undefined,
): PetHome | null {
  for (const pattern of PET_HOME_TABLE_PATTERNS) {
    const item = furniture.find((f) => f.type.toUpperCase().includes(pattern));
    if (!item) continue;
    const fp = infoOf(item.type) ?? { w: 1, h: 1 };
    const footprint = { col: item.col, row: item.row, w: fp.w, h: fp.h };
    const occupied = furniture.some((o) => {
      if (o === item || !infoOf(o.type)?.onSurface) return false;
      return (
        o.col >= footprint.col &&
        o.col < footprint.col + footprint.w &&
        o.row >= footprint.row &&
        o.row < footprint.row + footprint.h
      );
    });
    const home: PetHome = {
      col: item.col + Math.floor((fp.w - 1) / 2),
      row: item.row + Math.floor((fp.h - 1) / 2),
      radius: PET_HOME_RADIUS_TILES,
      footprint,
    };
    if (!occupied) {
      const c = tileCenter(home.col, home.row);
      home.perch = { x: c.x, y: c.y + TILE_SIZE / 2, zY: (item.row + fp.h) * TILE_SIZE + 0.5 };
    }
    return home;
  }
  return null;
}

/** Whether someone is near the table: within 3 tiles if seated, within 2 if standing. */
function personNearTable(home: PetHome | null, characters: Map<number, Character>): boolean {
  if (!home) return false;
  for (const ch of characters.values()) {
    if (ch.matrixEffect === 'despawn') continue;
    const radius =
      ch.state === CharacterState.TYPE
        ? PET_PERCH_SEATED_RADIUS_TILES
        : PET_PERCH_STANDING_RADIUS_TILES;
    if (manhattanDistance(home.col, home.row, ch.tileCol, ch.tileRow) <= radius) return true;
  }
  return false;
}

/** Whether a tile lies inside the pet's home zone (always true with no home). */
export function isNearPetHome(home: PetHome | null, col: number, row: number): boolean {
  return home === null || manhattanDistance(home.col, home.row, col, row) <= home.radius;
}

/** Inclusive-min / exclusive-max random float */
function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
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

/** Manhattan distance between two tile coords */
function manhattanDistance(c1: number, r1: number, c2: number, r2: number): number {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2);
}

/**
 * Pick the closest non-sub-agent character within PET_FOLLOW_RADIUS_TILES
 * by Manhattan distance. Excludes despawning characters (matrixEffect === 'despawn').
 */
function findNearbyCharacter(
  pet: Pet,
  characters: Map<number, Character>,
  home: PetHome | null,
): Character | null {
  let closest: Character | null = null;
  let closestDist = Number.POSITIVE_INFINITY;
  for (const ch of characters.values()) {
    if (ch.matrixEffect === 'despawn') continue;
    if (!isNearPetHome(home, ch.tileCol, ch.tileRow)) continue;
    const d = manhattanDistance(pet.tileCol, pet.tileRow, ch.tileCol, ch.tileRow);
    if (d > PET_FOLLOW_RADIUS_TILES) continue;
    if (d < closestDist) {
      closest = ch;
      closestDist = d;
    }
  }
  return closest;
}

/**
 * Find a walkable tile adjacent (4-connected) to a character's current tile.
 * Returns the first hit in N/S/W/E scan order, or null if all neighbours are blocked.
 */
function findAdjacentTile(
  ch: Character,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): { col: number; row: number } | null {
  const candidates = [
    { col: ch.tileCol, row: ch.tileRow - 1 },
    { col: ch.tileCol, row: ch.tileRow + 1 },
    { col: ch.tileCol - 1, row: ch.tileRow },
    { col: ch.tileCol + 1, row: ch.tileRow },
  ];
  for (const t of candidates) {
    if (isWalkable(t.col, t.row, tileMap, blockedTiles)) return t;
  }
  return null;
}

/** Advance the walk-cycle frame counter (4-step cycle). */
function updateWalkAnimation(pet: Pet, dt: number): void {
  pet.frameTimer += dt;
  if (pet.frameTimer >= PET_WALK_FRAME_DURATION_SEC) {
    pet.frameTimer -= PET_WALK_FRAME_DURATION_SEC;
    pet.frame = (pet.frame + 1) % 4;
  }
}

/** Advance the idle-cycle frame counter (4-step cycle, slower than walk). */
function updateIdleAnimation(pet: Pet, dt: number): void {
  pet.frameTimer += dt;
  if (pet.frameTimer >= PET_IDLE_FRAME_DURATION_SEC) {
    pet.frameTimer -= PET_IDLE_FRAME_DURATION_SEC;
    pet.frame = (pet.frame + 1) % 4;
  }
}

/**
 * Lerp the pet along its current `path`. When it reaches the next tile,
 * shift the tile off the path and update `tileCol`/`tileRow`. Sets `dir`.
 */
function movePetAlongPath(pet: Pet, dt: number, speed = PET_WALK_SPEED_PX_PER_SEC): void {
  if (pet.path.length === 0) return;
  const nextTile = pet.path[0];
  pet.dir = directionBetween(pet.tileCol, pet.tileRow, nextTile.col, nextTile.row);

  pet.moveProgress += (speed / TILE_SIZE) * dt;

  const fromCenter = tileCenter(pet.tileCol, pet.tileRow);
  const toCenter = tileCenter(nextTile.col, nextTile.row);
  const t = Math.min(pet.moveProgress, 1);
  pet.x = fromCenter.x + (toCenter.x - fromCenter.x) * t;
  pet.y = fromCenter.y + (toCenter.y - fromCenter.y) * t;

  if (pet.moveProgress >= 1) {
    pet.tileCol = nextTile.col;
    pet.tileRow = nextTile.row;
    pet.x = toCenter.x;
    pet.y = toCenter.y;
    pet.path.shift();
    pet.moveProgress = 0;
  }
}

/** Nearest walkable floor tile just outside a perch's tiles, to jump from / land on. */
function findGroundTile(
  pet: Pet,
  footprint: PerchSpot['footprint'],
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): { col: number; row: number } | null {
  const { col, row, w, h } = footprint;
  let best: { col: number; row: number } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let r = row - 1; r <= row + h; r++) {
    for (let c = col - 1; c <= col + w; c++) {
      const inside = c >= col && c < col + w && r >= row && r < row + h;
      if (inside || !isWalkable(c, r, tileMap, blockedTiles)) continue;
      const d = manhattanDistance(pet.tileCol, pet.tileRow, c, r);
      if (d < bestDist) {
        best = { col: c, row: r };
        bestDist = d;
      }
    }
  }
  return best;
}

function startHop(pet: Pet, to: { x: number; y: number }, up: boolean): void {
  pet.state = PetState.HOP;
  pet.hopUp = up;
  pet.hopProgress = 0;
  pet.hopFrom = { x: pet.x, y: pet.y };
  pet.hopTo = to;
  pet.path = [];
  pet.moveProgress = 0;
  if (!up) pet.perchTarget = null;
  pet.followTargetId = null;
  pet.chaseToBite = false;
  pet.frame = 0;
  pet.frameTimer = 0;
}

/** The current spot of a perch target, or null when it is gone or taken. */
function resolvePerch(
  target: PetPerchTarget | null,
  home: PetHome | null,
  tablePerch: PetHome['perch'],
  surroundings: PetSurroundings,
  characters: Map<number, Character>,
): PerchSpot | null {
  if (!target) return null;
  if (target.kind === 'table') {
    return home && tablePerch ? { ...tablePerch, footprint: home.footprint } : null;
  }
  if (target.kind === 'sofa') {
    const sofa = surroundings.sofas.find((s) => s.seatId === target.seatId);
    return sofa
      ? {
          x: sofa.x,
          y: sofa.y,
          zY: sofa.zY,
          footprint: { col: sofa.col, row: sofa.row, w: 1, h: 1 },
        }
      : null;
  }
  if (target.kind === 'tree') {
    const tree = surroundings.trees.find((t) => t.uid === target.uid);
    return tree ? { x: tree.x, y: tree.y, zY: tree.zY, footprint: tree.footprint } : null;
  }
  return lapSpot(characters.get(target.charId));
}

/**
 * Where this pet would like to jump up right now, by species: a dog only onto
 * a free sofa, a cat onto a seated agent's lap or the free table, anything
 * else onto the free table. Rolls the dice only when a spot exists.
 */
function choosePerch(
  pet: Pet,
  home: PetHome | null,
  tablePerch: PetHome['perch'],
  surroundings: PetSurroundings,
  characters: Map<number, Character>,
): PetPerchTarget | null {
  const near = (col: number, row: number) => manhattanDistance(pet.tileCol, pet.tileRow, col, row);
  if (pet.kind === PetKind.DOG) {
    const sofas = surroundings.sofas.filter(
      (s) =>
        !surroundings.claimed.has(`sofa:${s.seatId}`) && withinSeatSearch(pet, home, s.col, s.row),
    );
    if (sofas.length === 0 || Math.random() >= PET_SOFA_CHANCE) return null;
    sofas.sort((a, b) => near(a.col, a.row) - near(b.col, b.row));
    return { kind: 'sofa', seatId: sofas[0].seatId };
  }
  if (pet.kind === PetKind.CAT) {
    const trees = surroundings.trees.filter(
      (t) =>
        !surroundings.claimed.has(`tree:${t.uid}`) &&
        withinSeatSearch(pet, home, t.footprint.col, t.footprint.row),
    );
    if (trees.length > 0 && Math.random() < PET_CAT_TREE_CHANCE) {
      trees.sort(
        (a, b) => near(a.footprint.col, a.footprint.row) - near(b.footprint.col, b.footprint.row),
      );
      return { kind: 'tree', uid: trees[0].uid };
    }
    const laps = [...characters.values()].filter(
      (ch) =>
        !surroundings.claimed.has(`lap:${ch.id}`) &&
        lapSpot(ch) !== null &&
        withinSeatSearch(pet, home, ch.tileCol, ch.tileRow),
    );
    if (laps.length > 0 && Math.random() < PET_LAP_CHANCE) {
      laps.sort((a, b) => near(a.tileCol, a.tileRow) - near(b.tileCol, b.tileRow));
      return { kind: 'lap', charId: laps[0].id };
    }
  }
  if (home && tablePerch && Math.random() < PET_PERCH_CHANCE) return { kind: 'table' };
  return null;
}

/** A walking agent within reach for a dog to chase and bite, nearest first. */
function findWalkingLeg(
  pet: Pet,
  characters: Map<number, Character>,
  surroundings: PetSurroundings,
): Character | null {
  let best: Character | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const ch of characters.values()) {
    if (ch.state !== CharacterState.WALK || ch.matrixEffect || ch.isSubagent) continue;
    if (surroundings.claimed.has(`bite:${ch.id}`)) continue;
    const d = manhattanDistance(pet.tileCol, pet.tileRow, ch.tileCol, ch.tileRow);
    if (d > PET_BITE_RADIUS_TILES || d >= bestDist) continue;
    best = ch;
    bestDist = d;
  }
  return best;
}

/**
 * A walking agent that has just stepped onto the tile a resting dog occupies
 * (and still has somewhere to go, so there is a leg to drag along).
 */
function findSteppingLeg(
  pet: Pet,
  characters: Map<number, Character>,
  surroundings: PetSurroundings,
): Character | null {
  const col = Math.floor(pet.x / TILE_SIZE);
  const row = Math.floor(pet.y / TILE_SIZE);
  for (const ch of characters.values()) {
    // Only an agent that just arrived: one already on the tile (or leaving it) is not stepping on
    if (pet.onTileIds.has(ch.id)) continue;
    if (ch.state !== CharacterState.WALK || ch.matrixEffect || ch.isSubagent) continue;
    if (ch.tileCol !== col || ch.tileRow !== row || ch.path.length === 0) continue;
    if ((ch.petDragTimer ?? 0) > 0 || surroundings.claimed.has(`bite:${ch.id}`)) continue;
    return ch;
  }
  return null;
}

/** Remember who stands on the dog's tile this tick, so only a new arrival counts as a step-on. */
function trackOccupants(pet: Pet, characters: Map<number, Character>): void {
  const col = Math.floor(pet.x / TILE_SIZE);
  const row = Math.floor(pet.y / TILE_SIZE);
  pet.onTileIds.clear();
  for (const ch of characters.values()) {
    if (ch.tileCol === col && ch.tileRow === row) pet.onTileIds.add(ch.id);
  }
}

/** Sink the teeth in: the dog sticks to the leg for the next PET_BITE_DRAG_TILES tiles. */
function startBite(pet: Pet, target: Character): void {
  pet.state = PetState.BITE;
  pet.chaseToBite = false;
  pet.followTargetId = target.id;
  pet.perchTarget = null;
  pet.dir = pet.x <= target.x ? Direction.RIGHT : Direction.LEFT;
  // A leg caught mid-step first finishes the tile it is leaving: that one does not count
  pet.biteStepsLeft = PET_BITE_DRAG_TILES + (target.moveProgress > 0 ? 1 : 0);
  pet.biteTile = { col: target.tileCol, row: target.tileRow };
  pet.path = [];
  pet.moveProgress = 0;
  pet.frame = 0;
  pet.frameTimer = 0;
  target.petDragTimer = PET_BITE_DRAG_HOLD_SEC;
}

/** Back to IDLE with a fresh pause (the shared exit of FOLLOW / BITE). */
function settleIdle(pet: Pet): void {
  pet.state = PetState.IDLE;
  pet.followTargetId = null;
  pet.chaseToBite = false;
  pet.path = [];
  pet.moveProgress = 0;
  pet.frame = 0;
  pet.frameTimer = 0;
  pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
}

/** Let go of a leg: the agent walks on at full speed, the dog gets up. */
function releaseBite(pet: Pet, target: Character | undefined): void {
  if (target) {
    target.petDragTimer = 0;
    // The agent was walking, so its tile is floor: the dog drops there
    pet.tileCol = target.tileCol;
    pet.tileRow = target.tileRow;
    const c = tileCenter(target.tileCol, target.tileRow);
    pet.x = c.x;
    pet.y = c.y;
  }
  pet.perchZY = null;
  pet.perchTimer = 0;
  pet.biteTile = null;
  pet.biteStepsLeft = 0;
  pet.biteCooldown = PET_BITE_COOLDOWN_SEC;
  pet.dir = Direction.DOWN;
  settleIdle(pet);
}

/** Build a fresh pet at a tile with the IDLE FSM entry point. */
export function createPet(
  id: string,
  petType: number,
  col: number,
  row: number,
  kind: Pet['kind'] = PetKind.OTHER,
): Pet {
  const center = tileCenter(col, row);
  return {
    id,
    name: '', // Filled by OfficeState.addPet() via getPetName(petType)
    petType,
    kind,
    state: PetState.IDLE,
    dir: Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    frame: 0,
    frameTimer: 0,
    wanderTimer: randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC),
    followTargetId: null,
    followRecalcTimer: 0,
    followDuration: 0,
    followDurationLimit: 0,
    perchTarget: null,
    chaseToBite: false,
    biteCooldown: 0,
    biteStepsLeft: 0,
    biteTile: null,
    onTileIds: new Set(),
    hopUp: true,
    hopProgress: 0,
    hopFrom: { x: center.x, y: center.y },
    hopTo: { x: center.x, y: center.y },
    groundTile: null,
    perchTimer: 0,
    perchZY: null,
    bubbleType: null,
    bubbleTimer: 0,
  };
}

/**
 * Tick the pet's FSM by `dt` seconds. Mutates `pet` in place.
 * `walkableTiles`/`characters`/`tileMap`/`blockedTiles` are read-only inputs.
 */
export function updatePet(
  pet: Pet,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  characters: Map<number, Character>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  home: PetHome | null = null,
  surroundings: PetSurroundings = NO_SURROUNDINGS,
): void {
  // Only wander within reach of the table (a pet elsewhere walks back to it).
  const roamTiles = home
    ? walkableTiles.filter((t) => isNearPetHome(home, t.col, t.row))
    : walkableTiles;
  // The table is a perch only while it is free and someone is around it.
  const tablePerch = home?.perch && personNearTable(home, characters) ? home.perch : undefined;
  const spotOf = (target: PetPerchTarget | null) =>
    resolvePerch(target, home, tablePerch, surroundings, characters);
  if (pet.biteCooldown > 0) pet.biteCooldown = Math.max(0, pet.biteCooldown - dt);

  // A resting dog (on the floor, or up on a sofa) bites whoever steps onto its tile
  const resting =
    pet.state === PetState.IDLE || (pet.state === PetState.SIT && pet.perchTarget?.kind === 'sofa');
  if (pet.kind === PetKind.DOG && resting && pet.biteCooldown <= 0) {
    const leg = findSteppingLeg(pet, characters, surroundings);
    if (leg) startBite(pet, leg);
  }
  if (pet.state !== PetState.BITE) trackOccupants(pet, characters);

  switch (pet.state) {
    case PetState.HOP: {
      pet.hopProgress = Math.min(1, pet.hopProgress + dt / PET_HOP_DURATION_SEC);
      const t = pet.hopProgress;
      pet.x = pet.hopFrom.x + (pet.hopTo.x - pet.hopFrom.x) * t;
      pet.y =
        pet.hopFrom.y + (pet.hopTo.y - pet.hopFrom.y) * t - Math.sin(Math.PI * t) * PET_HOP_ARC_PX;
      if (t < 1) break;
      pet.frame = 0;
      pet.frameTimer = 0;
      const spot = pet.hopUp ? spotOf(pet.perchTarget) : null;
      if (spot) {
        pet.state = PetState.SIT;
        pet.x = spot.x;
        pet.y = spot.y;
        pet.perchZY = spot.zY;
        // On a sofa or a lap the pet faces out of the picture
        if (pet.perchTarget?.kind !== 'table') pet.dir = Direction.DOWN;
        pet.perchTimer = randomRange(PET_PERCH_DURATION_MIN_SEC, PET_PERCH_DURATION_MAX_SEC);
      } else {
        // Landed on the floor (or the perch vanished mid-jump).
        pet.state = PetState.IDLE;
        pet.perchTarget = null;
        pet.perchZY = null;
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        if (pet.groundTile) {
          pet.tileCol = pet.groundTile.col;
          pet.tileRow = pet.groundTile.row;
        }
        const c = tileCenter(pet.tileCol, pet.tileRow);
        pet.x = c.x;
        pet.y = c.y;
      }
      break;
    }

    case PetState.SIT: {
      updateIdleAnimation(pet, dt);
      pet.perchTimer -= dt;
      // Hop down when rested, or when the perch stopped being free (a PC went
      // on the table, someone claimed the sofa, the lap stood up).
      const spot = spotOf(pet.perchTarget);
      if (pet.perchTimer > 0 && spot) {
        pet.x = spot.x;
        pet.y = spot.y;
        break;
      }
      const ground = pet.groundTile ?? { col: pet.tileCol, row: pet.tileRow };
      const c = tileCenter(ground.col, ground.row);
      startHop(pet, { x: c.x, y: c.y }, false);
      break;
    }

    case PetState.BITE: {
      const target = pet.followTargetId !== null ? characters.get(pet.followTargetId) : undefined;
      // Let go once the agent stops (sat down, went to work, arrived)
      if (!target || target.matrixEffect === 'despawn' || target.state !== CharacterState.WALK) {
        releaseBite(pet, target);
        break;
      }
      // Count the tiles the agent has dragged us over; let go after the last
      if (
        pet.biteTile &&
        (target.tileCol !== pet.biteTile.col || target.tileRow !== pet.biteTile.row)
      ) {
        pet.biteStepsLeft--;
        pet.biteTile = { col: target.tileCol, row: target.tileRow };
        if (pet.biteStepsLeft <= 0) {
          releaseBite(pet, target);
          break;
        }
      }
      // Hang on to the leg: the agent walks on slowly, dragging the dog
      target.petDragTimer = PET_BITE_DRAG_HOLD_SEC;
      // Lying side-on behind the leg: walking sideways turns the dog to follow,
      // walking up or down keeps the side it caught the leg from
      if (target.dir === Direction.RIGHT || target.dir === Direction.LEFT) pet.dir = target.dir;
      pet.x =
        target.x +
        (pet.dir === Direction.RIGHT ? -PET_BITE_SIDE_OFFSET_PX : PET_BITE_SIDE_OFFSET_PX);
      const trail =
        target.dir === Direction.DOWN
          ? -PET_BITE_TRAIL_PX
          : target.dir === Direction.UP
            ? PET_BITE_TRAIL_PX
            : 0;
      pet.y = target.y + trail;
      // In front of the agent so the bite shows, unless it trails above them
      const agentZY = target.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;
      pet.perchZY = trail < 0 ? agentZY - 0.1 : agentZY + 0.1;
      updateWalkAnimation(pet, dt); // paws scrabbling, jaws working
      break;
    }

    case PetState.IDLE: {
      updateIdleAnimation(pet, dt);
      pet.wanderTimer -= dt;
      if (pet.wanderTimer > 0) break;

      // A free perch nearby? Sometimes go sit on it.
      const target = choosePerch(pet, home, tablePerch, surroundings, characters);
      const spot = spotOf(target);
      if (target && spot) {
        const ground = findGroundTile(pet, spot.footprint, tileMap, blockedTiles);
        if (ground) {
          pet.groundTile = ground;
          pet.perchTarget = target;
          if (ground.col === pet.tileCol && ground.row === pet.tileRow) {
            startHop(pet, { x: spot.x, y: spot.y }, true);
            break;
          }
          const path = findPath(
            pet.tileCol,
            pet.tileRow,
            ground.col,
            ground.row,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            pet.state = PetState.WALK;
            pet.path = path;
            pet.moveProgress = 0;
            pet.frame = 0;
            pet.frameTimer = 0;
            break;
          }
          pet.perchTarget = null;
        }
      }

      // A dog may chase someone walking past to bite their leg
      if (pet.kind === PetKind.DOG && pet.biteCooldown <= 0) {
        const leg = findWalkingLeg(pet, characters, surroundings);
        if (leg && Math.random() < PET_BITE_CHANCE) {
          pet.state = PetState.FOLLOW;
          pet.chaseToBite = true;
          pet.followTargetId = leg.id;
          pet.followDuration = 0;
          pet.followRecalcTimer = 0;
          pet.followDurationLimit = PET_CHASE_MAX_SEC;
          pet.frame = 0;
          pet.frameTimer = 0;
          break;
        }
      }

      // Roll for follow first
      if (Math.random() < PET_FOLLOW_CHANCE) {
        const target = findNearbyCharacter(pet, characters, home);
        if (target) {
          pet.state = PetState.FOLLOW;
          pet.followTargetId = target.id;
          pet.followDuration = 0;
          pet.followRecalcTimer = 0;
          pet.followDurationLimit = randomRange(
            PET_FOLLOW_DURATION_MIN_SEC,
            PET_FOLLOW_DURATION_MAX_SEC,
          );
          pet.frame = 0;
          pet.frameTimer = 0;
          break;
        }
      }

      // Else pick a random walkable tile (not own) and try to walk there
      if (roamTiles.length > 0) {
        // Filter out own tile to avoid zero-length paths
        const candidates = roamTiles.filter((t) => t.col !== pet.tileCol || t.row !== pet.tileRow);
        if (candidates.length > 0) {
          const target = candidates[Math.floor(Math.random() * candidates.length)];
          const path = findPath(
            pet.tileCol,
            pet.tileRow,
            target.col,
            target.row,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            pet.state = PetState.WALK;
            pet.path = path;
            pet.moveProgress = 0;
            pet.frame = 0;
            pet.frameTimer = 0;
          }
        }
      }
      pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
      break;
    }

    case PetState.WALK: {
      updateWalkAnimation(pet, dt);
      movePetAlongPath(pet, dt);

      if (pet.path.length === 0 && pet.moveProgress === 0) {
        // Arrived next to the perch: jump up if it is still free.
        const spot = spotOf(pet.perchTarget);
        if (spot) {
          startHop(pet, { x: spot.x, y: spot.y }, true);
          break;
        }
        pet.perchTarget = null;
        pet.state = PetState.IDLE;
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        pet.frame = 0;
        pet.frameTimer = 0;
      }
      break;
    }

    case PetState.FOLLOW: {
      pet.followDuration += dt;
      const target = pet.followTargetId !== null ? characters.get(pet.followTargetId) : undefined;

      // Exit: target gone, or the time is up
      if (!target || pet.followDuration >= pet.followDurationLimit) {
        settleIdle(pet);
        break;
      }

      if (pet.chaseToBite) {
        // The leg stopped walking (arrived, sat down): nothing to grab
        if (target.state !== CharacterState.WALK || target.matrixEffect) {
          settleIdle(pet);
          break;
        }
        // Close enough: grab the leg from whichever side the dog is on
        if (Math.hypot(pet.x - target.x, pet.y - target.y) <= PET_BITE_REACH_PX) {
          startBite(pet, target);
          break;
        }
        // Run after it, re-aiming often since it keeps moving
        pet.followRecalcTimer -= dt;
        if (pet.followRecalcTimer <= 0) {
          const goal = target.path[0] ?? { col: target.tileCol, row: target.tileRow };
          const path = findPath(
            pet.tileCol,
            pet.tileRow,
            goal.col,
            goal.row,
            tileMap,
            blockedTiles,
          );
          // Keep the step in progress: only replace the path once it is done
          if (path.length > 0 && pet.moveProgress === 0) pet.path = path;
          pet.followRecalcTimer = PET_CHASE_RECALC_INTERVAL_SEC;
        }
        updateWalkAnimation(pet, dt);
        movePetAlongPath(pet, dt, PET_CHASE_SPEED_PX_PER_SEC);
        break;
      }

      // Exit: target walked away from the table
      if (!isNearPetHome(home, target.tileCol, target.tileRow)) {
        settleIdle(pet);
        break;
      }

      // Exit: reached target (Manhattan distance ≤ 1)
      const dist = manhattanDistance(pet.tileCol, pet.tileRow, target.tileCol, target.tileRow);
      if (dist <= 1) {
        // Face the target before settling
        if (dist === 1) {
          pet.dir = directionBetween(pet.tileCol, pet.tileRow, target.tileCol, target.tileRow);
        }
        settleIdle(pet);
        break;
      }

      // Continue following: recompute path periodically
      pet.followRecalcTimer -= dt;
      if (pet.followRecalcTimer <= 0) {
        const adj = findAdjacentTile(target, tileMap, blockedTiles);
        if (adj) {
          const path = findPath(pet.tileCol, pet.tileRow, adj.col, adj.row, tileMap, blockedTiles);
          if (path.length > 0) {
            pet.path = path;
            pet.moveProgress = 0;
          }
        }
        pet.followRecalcTimer = PET_FOLLOW_RECALC_INTERVAL_SEC;
      }

      updateWalkAnimation(pet, dt);
      movePetAlongPath(pet, dt);
      break;
    }
  }
}

/**
 * Resolve the sprite for the pet's current state + direction + frame.
 * Returns null when sprites haven't loaded yet — renderer guards.
 */
export function getPetSpriteData(pet: Pet, petSprites: PetSpriteFrames | null): SpriteData | null {
  if (!petSprites) return null;

  if (pet.state === PetState.BITE) {
    const frames = pet.dir === Direction.LEFT ? petSprites.biteLeft : petSprites.biteRight;
    return frames[PET_WALK_SEQUENCE[pet.frame % PET_WALK_SEQUENCE.length]];
  }

  if (pet.state === PetState.IDLE || pet.state === PetState.SIT) {
    const frameIdx = PET_IDLE_SEQUENCE[pet.frame % PET_IDLE_SEQUENCE.length];
    switch (pet.dir) {
      case Direction.DOWN:
        return petSprites.idleDown[frameIdx];
      case Direction.UP:
        return petSprites.idleUp[frameIdx];
      case Direction.RIGHT:
        return petSprites.idleRight[frameIdx];
      case Direction.LEFT:
        return petSprites.idleLeft[frameIdx];
    }
  }

  // WALK or FOLLOW
  const frameIdx = PET_WALK_SEQUENCE[pet.frame % PET_WALK_SEQUENCE.length];
  switch (pet.dir) {
    case Direction.DOWN:
      return petSprites.walkDown[frameIdx];
    case Direction.UP:
      return petSprites.walkUp[frameIdx];
    case Direction.RIGHT:
      return petSprites.walkRight[frameIdx];
    case Direction.LEFT:
      return petSprites.walkLeft[frameIdx];
  }
}
