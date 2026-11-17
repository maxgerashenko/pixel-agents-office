/**
 * Tired agents: a long stretch of work (or a nearly full context after a
 * shorter one) wears an agent out; it slumps and yawns, and when it next goes
 * idle it walks to a vending machine for a drink (never inside an Area) and
 * comes back rested.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import {
  TIRED_ACTIVE_SEC,
  TIRED_CONTEXT_MIN_ACTIVE_SEC,
  TIRED_IDLE_RECOVER_SEC,
} from '../src/constants.js';
import { isYawning } from '../src/office/engine/characters.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import { tiredSprite } from '../src/office/sprites/spriteData.js';
import type { OfficeLayout, PlacedFurniture, SpriteData } from '../src/office/types.js';
import { CharacterState, Direction, TileType } from '../src/office/types.js';

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
    asset('VENDING_MACHINE_FRONT_OFF', 'electronics', {
      height: 32,
      footprintH: 2,
      backgroundTiles: 1,
      groupId: 'VENDING_MACHINE',
      orientation: 'front',
      state: 'off',
    }),
  ];
  const sprites = Object.fromEntries(catalog.map((a) => [a.id, [[a.id]]]));
  assert.ok(buildDynamicCatalog({ catalog, sprites }));
});

const COLS = 10;
const ROWS = 8;

function f(uid: string, type: string, col: number, row: number): PlacedFurniture {
  return { uid, type, col, row };
}

function layout(furniture: PlacedFurniture[], areaCols?: [number, number]): OfficeLayout {
  const l = {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: Array.from({ length: COLS * ROWS }, (_, i) =>
      i < COLS || i % COLS === COLS - 1 ? TileType.WALL : TileType.FLOOR_1,
    ),
    furniture: [
      f('desk', 'DESK', 1, 1),
      f('pc', 'PC', 1, 1),
      f('chair', 'WOODEN_CHAIR', 1, 2),
      ...furniture,
    ],
  } as OfficeLayout;
  if (areaCols) {
    (l as unknown as Record<string, unknown>).areas = [{ label: 'Eng' }];
    (l as unknown as Record<string, unknown>).areaTiles = Array.from(
      { length: COLS * ROWS },
      (_, i) => {
        const c = i % COLS;
        return c >= areaCols[0] && c <= areaCols[1] ? 'Eng' : null;
      },
    );
  }
  return l;
}

function simulate(os: OfficeState, seconds: number, onTick?: () => void): void {
  for (let t = 0; t < seconds; t += 0.05) {
    os.update(0.05);
    onTick?.();
  }
}

function workFor(os: OfficeState, id: number, seconds: number): void {
  os.setAgentActive(id, true);
  simulate(os, seconds);
}

test('a long stretch of work wears an agent out; a short one does not', () => {
  const os = new OfficeState(layout([]));
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  workFor(os, 1, 60);
  assert.ok(!ch.tired);
  workFor(os, 1, TIRED_ACTIVE_SEC);
  assert.ok(ch.tired);
});

test('a nearly full context tires an agent sooner, but not at once', () => {
  const os = new OfficeState(layout([]));
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  os.setAgentContext(1, 190_000, 200_000);
  workFor(os, 1, 30);
  assert.ok(!ch.tired, 'a fresh agent with a full context is not tired yet');
  workFor(os, 1, TIRED_CONTEXT_MIN_ACTIVE_SEC);
  assert.ok(ch.tired);
});

test('a tired idle agent walks to the vending machine, then comes back rested', () => {
  const os = new OfficeState(layout([f('vend', 'VENDING_MACHINE_FRONT_OFF', 6, 0)]));
  assert.deepEqual(
    [...os.breakSpots.entries()].map(([k, v]) => [k, v.col, v.row]),
    [['break:vend', 6, 2]],
  );
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  workFor(os, 1, TIRED_ACTIVE_SEC + 1);
  assert.ok(ch.tired);
  os.setAgentActive(1, false);
  let drinking = false;
  simulate(os, 120, () => {
    if (ch.breakSpotId && ch.state === CharacterState.TYPE) {
      drinking = true;
      assert.deepEqual([ch.tileCol, ch.tileRow], [6, 2]);
      assert.equal(ch.dir, Direction.UP);
    }
  });
  assert.ok(drinking, 'the agent had a drink');
  assert.ok(!ch.tired, 'rested after the break');
  assert.equal(ch.activeSec, 0);
});

test('no break spot inside an Area buffer, and work cuts a break short', () => {
  const inArea = new OfficeState(layout([f('vend', 'VENDING_MACHINE_FRONT_OFF', 6, 0)], [5, 7]));
  assert.equal(inArea.breakSpots.size, 0);

  const os = new OfficeState(layout([f('vend', 'VENDING_MACHINE_FRONT_OFF', 6, 0)]));
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  workFor(os, 1, TIRED_ACTIVE_SEC + 1);
  os.setAgentActive(1, false);
  for (let t = 0; t < 120 && !(ch.breakSpotId && ch.state === CharacterState.TYPE); t += 0.05) {
    os.update(0.05);
  }
  assert.ok(ch.breakSpotId, 'agent started its break');
  os.setAgentActive(1, true);
  simulate(os, 30);
  assert.equal(ch.breakSpotId, null);
  const seat = os.seats.get(ch.seatId!)!;
  assert.deepEqual([ch.tileCol, ch.tileRow], [seat.seatCol, seat.seatRow]);
});

test('with nowhere to go a tired idle agent recovers after a long idle', () => {
  const os = new OfficeState(layout([]));
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  workFor(os, 1, TIRED_ACTIVE_SEC + 1);
  os.setAgentActive(1, false);
  assert.ok(ch.tired);
  simulate(os, TIRED_IDLE_RECOVER_SEC + 5);
  assert.ok(!ch.tired);
});

test('the tired sprite sinks the head two rows and the yawn opens the mouth', () => {
  const px = 'x';
  const sprite: SpriteData = Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (y >= 3 && y < 31 && x >= 2 && x < 14 ? px : '')),
  );
  const slumped = tiredSprite(sprite, Direction.DOWN, false);
  assert.equal(
    slumped[3].every((c) => c === ''),
    true,
    'the top rows are vacated',
  );
  assert.notEqual(slumped[5][8], '');
  const yawn = tiredSprite(sprite, Direction.DOWN, true);
  assert.notDeepEqual(yawn, slumped);
  assert.equal(tiredSprite(sprite, Direction.DOWN, false), slumped, 'memoized');
});

test('yawns come and go while tired, never while rested', () => {
  const os = new OfficeState(layout([]));
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  assert.ok(!isYawning(ch));
  ch.tired = true;
  const seen = new Set<boolean>();
  for (let t = 0; t < 20; t += 0.1) {
    ch.tiredClock = t;
    seen.add(isYawning(ch));
  }
  assert.deepEqual([...seen].sort(), [false, true]);
});
