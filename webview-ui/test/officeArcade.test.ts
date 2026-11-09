/**
 * Arcade machines: idle agents stand in front of one and play, never inside a
 * marked Area or its buffer, one agent per machine, and work wins over play.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { OfficeState } from '../src/office/engine/officeState.js';
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
    asset('ARCADE_MACHINE', 'misc', { height: 32, footprintH: 2 }),
  ];
  const sprites = Object.fromEntries(catalog.map((a) => [a.id, [[]]]));
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
    tiles: new Array<TileType>(COLS * ROWS).fill(TileType.FLOOR_1),
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

function idleAgent(os: OfficeState, id: number): void {
  os.addAgent(id, undefined, undefined, undefined, true);
  os.setAgentActive(id, false);
}

test('a play spot sits just below the machine', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE', 6, 1)]));
  assert.deepEqual(
    [...os.playSpots.entries()].map(([k, v]) => [k, v.col, v.row]),
    [['play:arc', 6, 3]],
  );
});

test('no play spot for a machine whose front is in an Area buffer', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE', 6, 1)], [5, 7]));
  assert.equal(os.playSpots.size, 0);
});

test('idle agents play at the machine, one per machine, facing it', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE', 6, 1)]));
  idleAgent(os, 1);
  idleAgent(os, 2);
  let played = false;
  simulate(os, 1500, () => {
    const players = [...os.characters.values()].filter((c) => c.playSpotId);
    assert.ok(players.length <= 1, 'one agent per machine');
    for (const c of players) {
      if (c.state === CharacterState.TYPE) {
        played = true;
        assert.deepEqual([c.tileCol, c.tileRow], [6, 3]);
      }
    }
  });
  assert.ok(played, 'an agent played');
});

test('a playing agent that becomes active leaves the machine for its computer', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE', 6, 1)]));
  idleAgent(os, 1);
  const ch = os.characters.get(1)!;
  for (let t = 0; t < 1500 && !(ch.playSpotId && ch.state === CharacterState.TYPE); t += 0.05) {
    os.update(0.05);
  }
  assert.ok(ch.playSpotId, 'agent started playing');
  os.setAgentActive(1, true);
  simulate(os, 30);
  assert.equal(ch.playSpotId, null);
  const seat = os.seats.get(ch.seatId!)!;
  assert.deepEqual([ch.tileCol, ch.tileRow], [seat.seatCol, seat.seatRow]);
});
