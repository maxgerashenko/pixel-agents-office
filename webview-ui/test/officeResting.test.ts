/**
 * Where idle agents go: benches/sofas for rest, never into a marked Area or
 * the 1-tile buffer around it.
 *
 * Like teammateSeating and greeter, this tests the OfficeState domain model —
 * seat roles, claims and the wander FSM over simulated minutes are invariants
 * e2e can only sample, not pin.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { OfficeState } from '../src/office/engine/officeState.js';
import { isNearArea, zoneAt } from '../src/office/engine/seatPlacement.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout, PlacedFurniture } from '../src/office/types.js';
import { CharacterState, TileType } from '../src/office/types.js';

type CatalogAsset = LoadedAssetData['catalog'][number];

function asset(id: string, category: string, extra: Partial<CatalogAsset> = {}): CatalogAsset {
  return {
    id,
    label: id,
    category,
    width: 16,
    height: 16,
    footprintW: 1,
    footprintH: 1,
    isDesk: false,
    ...extra,
  };
}

beforeAll(() => {
  const catalog = [
    asset('DESK', 'desks', { isDesk: true }),
    asset('PC', 'electronics', { canPlaceOnSurfaces: true }),
    asset('WOODEN_CHAIR', 'chairs'),
    asset('SOFA', 'chairs'),
    asset('WOODEN_BENCH', 'chairs'),
    asset('CUSHIONED_CHAIR', 'chairs'),
  ];
  const sprites = Object.fromEntries(catalog.map((a) => [a.id, [[]]]));
  assert.ok(buildDynamicCatalog({ catalog, sprites }));
});

const COLS = 10;
const ROWS = 7;
const AREA = 'Engineering';
/** Area footprint: cols 3–5, rows 0–3 (covers workstation "w2" and sofa "sofa-in-area"). */
const inArea = (col: number, row: number): boolean => col >= 3 && col <= 5 && row <= 3;

function f(uid: string, type: string, col: number, row: number): PlacedFurniture {
  return { uid, type, col, row };
}

/** A desk + PC with its chair one tile below, facing up at the PC. */
function workstation(name: string, col: number): PlacedFurniture[] {
  return [
    f(`${name}-desk`, 'DESK', col, 1),
    f(`${name}-pc`, 'PC', col, 1),
    f(name, 'WOODEN_CHAIR', col, 2),
  ];
}

function layout(withArea = true): OfficeLayout {
  return {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: new Array<TileType>(COLS * ROWS).fill(TileType.FLOOR_1),
    furniture: [
      ...workstation('w1', 1),
      ...workstation('w2', 4), // inside the Area
      ...workstation('w3', 7),
      f('dining', 'WOODEN_CHAIR', 8, 5), // no computer: neither work nor rest
      f('sofa', 'SOFA', 1, 5),
      f('bench', 'WOODEN_BENCH', 3, 5),
      f('cushioned', 'CUSHIONED_CHAIR', 6, 5),
      f('sofa-in-area', 'SOFA', 5, 3),
    ],
    ...(withArea
      ? {
          areas: [{ label: AREA }],
          areaTiles: Array.from({ length: COLS * ROWS }, (_, i) =>
            inArea(i % COLS, Math.floor(i / COLS)) ? AREA : null,
          ),
        }
      : {}),
  } as OfficeLayout;
}

/** Add an agent that just finished its turn, so the idle FSM takes over. */
function addIdleAgent(os: OfficeState, id: number, preferredSeatId?: string): void {
  os.addAgent(id, undefined, undefined, preferredSeatId, true);
  os.setAgentActive(id, false);
}

function simulate(os: OfficeState, seconds: number, onTick?: () => void): void {
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) {
    os.update(dt);
    onTick?.();
  }
}

test('rest seats: benches/sofas outside Areas and away from computers, nothing else', () => {
  const os = new OfficeState(layout());
  assert.deepEqual([...os.restSeatIds].sort(), ['bench', 'sofa']);
});

test('a bench facing a computer is a work seat, not a rest seat', () => {
  const l = layout(false);
  l.furniture = [
    f('desk', 'DESK', 1, 1),
    f('pc', 'PC', 1, 1),
    f('bench-at-pc', 'WOODEN_BENCH', 1, 2),
    f('sofa', 'SOFA', 5, 5),
  ];
  const os = new OfficeState(l);
  assert.deepEqual([...os.restSeatIds], ['sofa']);
});

test('idle agents never wander into an Area, and go rest on a bench or sofa', () => {
  const os = new OfficeState(layout());
  for (const tile of os.wanderTiles) {
    assert.equal(zoneAt(os.layout.areaTiles, COLS, tile.col, tile.row), null);
  }

  addIdleAgent(os, 1, 'w2'); // starts at w2, inside the Area
  addIdleAgent(os, 2);
  const restedOn = new Set<string>();
  const left = new Set<number>();
  simulate(os, 900, () => {
    for (const ch of os.characters.values()) {
      if (!inArea(ch.tileCol, ch.tileRow)) left.add(ch.id);
      // Once out of the Area, an idle agent never stops on an Area tile again
      if (left.has(ch.id) && ch.state !== CharacterState.WALK) {
        assert.ok(!inArea(ch.tileCol, ch.tileRow), `agent ${ch.id} lingered in the Area`);
      }
      if (ch.restSeatId && ch.state === CharacterState.TYPE) {
        const seat = os.seats.get(ch.restSeatId)!;
        assert.deepEqual([ch.tileCol, ch.tileRow], [seat.seatCol, seat.seatRow]);
        restedOn.add(ch.restSeatId);
      }
    }
    const claims = [...os.characters.values()].map((c) => c.restSeatId).filter(Boolean);
    assert.equal(new Set(claims).size, claims.length, 'one agent per rest seat');
  });
  assert.ok(restedOn.size > 0, 'agents rested');
  for (const uid of restedOn) assert.ok(['sofa', 'bench'].includes(uid), `rested on ${uid}`);
});

test('an idle agent never rests on a sofa another agent was given as its work seat', () => {
  const os = new OfficeState(layout(false));
  os.addAgent(1, undefined, undefined, undefined, true);
  os.reassignSeat(1, 'sofa'); // the user seated it on the sofa by hand
  addIdleAgent(os, 2);
  simulate(os, 900, () => {
    assert.notEqual(os.characters.get(2)!.restSeatId, 'sofa');
  });
});

test('a resting agent that becomes active gets up and walks to its computer', () => {
  const os = new OfficeState(layout(false));
  addIdleAgent(os, 1);
  const ch = os.characters.get(1)!;
  for (let t = 0; t < 1200 && !(ch.restSeatId && ch.state === CharacterState.TYPE); t += 0.05) {
    os.update(0.05);
  }
  assert.ok(ch.restSeatId, 'agent sat down to rest');

  os.setAgentActive(1, true);
  const seat = os.seats.get(ch.seatId!)!;
  simulate(os, 30);
  assert.equal(ch.restSeatId, null, 'rest seat released');
  assert.equal(ch.state, CharacterState.TYPE);
  assert.deepEqual([ch.tileCol, ch.tileRow], [seat.seatCol, seat.seatRow]);
});

test('zoneAt: the Area label at a tile, null outside Areas or without areas', () => {
  const tiles = areaTilesOf();
  assert.equal(zoneAt(tiles, COLS, 4, 1), AREA);
  assert.equal(zoneAt(tiles, COLS, 0, 0), null);
  assert.equal(zoneAt(tiles, COLS, -1, 1), null);
  assert.equal(zoneAt(tiles, COLS, COLS, 1), null);
  assert.equal(zoneAt(tiles, COLS, 4, -1), null);
  assert.equal(zoneAt(tiles, COLS, 4, ROWS + 5), null);
  assert.equal(zoneAt(undefined, COLS, 4, 1), null);
  assert.equal(zoneAt([], COLS, 4, 1), null);
});

function areaTilesOf(): Array<string | null> {
  return layout().areaTiles as Array<string | null>;
}

/** Within one tile (diagonals included) of the Area footprint, or inside it. */
const nearArea = (col: number, row: number): boolean => col >= 2 && col <= 6 && row <= 4;

test('isNearArea: inside, adjacent and diagonal tiles count; two tiles away does not', () => {
  const tiles = areaTilesOf();
  assert.equal(isNearArea(tiles, COLS, ROWS, 4, 1), true); // inside
  assert.equal(isNearArea(tiles, COLS, ROWS, 2, 1), true); // adjacent (left)
  assert.equal(isNearArea(tiles, COLS, ROWS, 6, 4), true); // diagonal corner
  assert.equal(isNearArea(tiles, COLS, ROWS, 4, 4), true); // adjacent (below)
  assert.equal(isNearArea(tiles, COLS, ROWS, 1, 1), false);
  assert.equal(isNearArea(tiles, COLS, ROWS, 4, 5), false);
  assert.equal(isNearArea(tiles, COLS, ROWS, 7, 0), false);
  assert.equal(isNearArea(undefined, COLS, ROWS, 4, 1), false);
});

test('wanderTiles exclude the Area and every tile adjacent or diagonal to it', () => {
  const os = new OfficeState(layout());
  assert.ok(os.wanderTiles.length > 0);
  for (const tile of os.wanderTiles) {
    assert.ok(
      !nearArea(tile.col, tile.row),
      `wander tile ${tile.col},${tile.row} is in the buffer`,
    );
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      assert.equal(os.noIdleTileKeys.has(`${col},${row}`), nearArea(col, row), `${col},${row}`);
    }
  }
});

test('an agent standing up from a seat outside the buffer keeps its wander pause', () => {
  // Chair tiles are not walkable, so they are never wander tiles; only the
  // buffer may cut the pause short.
  const os = new OfficeState(layout());
  addIdleAgent(os, 1, 'w1');
  const ch = os.characters.get(1)!;
  const seat = os.seats.get('w1')!;
  ch.state = CharacterState.IDLE as typeof ch.state;
  ch.wanderTimer = 1000;
  simulate(os, 5);
  assert.equal(ch.state, CharacterState.IDLE);
  assert.deepEqual([ch.tileCol, ch.tileRow], [seat.seatCol, seat.seatRow]);
});

test('a sofa next to an Area is not a rest seat', () => {
  const l = layout();
  l.furniture = [
    f('adjacent-sofa', 'SOFA', 6, 4),
    f('diagonal-sofa', 'SOFA', 2, 4),
    f('far-sofa', 'SOFA', 8, 6),
  ];
  const os = new OfficeState(l);
  assert.deepEqual([...os.restSeatIds], ['far-sofa']);
});

test('an idle agent placed in the buffer walks out promptly and never idles in it again', () => {
  const os = new OfficeState(layout());
  addIdleAgent(os, 1);
  const ch = os.characters.get(1)!;
  // Stand in the buffer (not the Area itself), on the Area's right edge
  const x = 6;
  const y = 2;
  assert.ok(nearArea(x, y) && !inArea(x, y));
  ch.tileCol = x;
  ch.tileRow = y;
  ch.x = x * 16 + 8;
  ch.y = y * 16 + 8;
  ch.state = CharacterState.IDLE as typeof ch.state;
  ch.path = [];
  ch.wanderTimer = 1000; // a pause this long would strand it without the buffer rule

  let walkedOut = false;
  const dt = 0.05;
  for (let t = 0; t < 8; t += dt) {
    os.update(dt);
    if (ch.state !== CharacterState.WALK && !nearArea(ch.tileCol, ch.tileRow)) {
      walkedOut = true;
      break;
    }
  }
  assert.ok(walkedOut, 'left the buffer within a few seconds');

  simulate(os, 600, () => {
    if (ch.state !== CharacterState.WALK) {
      assert.ok(!nearArea(ch.tileCol, ch.tileRow), 'idle on a buffer tile');
    }
  });
});

test('when the buffer covers every tile, idle agents fall back to tiles outside the Area', () => {
  const l = layout();
  // Area stripes on columns 1, 4 and 7; column 9 is void, so every walkable tile is within 1 of one
  const stripe = (c: number): boolean => c === 1 || c === 4 || c === 7;
  l.areaTiles = Array.from({ length: COLS * ROWS }, (_, i) => (stripe(i % COLS) ? AREA : null));
  l.tiles = l.tiles.map((t, i) => (i % COLS === 9 ? TileType.VOID : t));
  l.furniture = [];
  const os = new OfficeState(l);
  assert.ok(os.walkableTiles.length > 0);
  for (const t of os.walkableTiles) assert.ok(isNearArea(l.areaTiles, COLS, ROWS, t.col, t.row));
  assert.ok(os.wanderTiles.length > 0);
  for (const t of os.wanderTiles) assert.equal(zoneAt(l.areaTiles, COLS, t.col, t.row), null);
  assert.ok(os.wanderTiles.length < os.walkableTiles.length);
});

test('when Areas cover the whole floor, wanderTiles fall back to every walkable tile', () => {
  const l = layout();
  l.areaTiles = new Array<string | null>(COLS * ROWS).fill(AREA);
  const os = new OfficeState(l);
  assert.equal(os.wanderTiles.length, os.walkableTiles.length);
});
