/**
 * Where idle agents go: benches/sofas for rest, never into a marked Area.
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
import { zoneAt } from '../src/office/engine/seatPlacement.js';
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
