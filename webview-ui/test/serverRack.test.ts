/**
 * Server rack: a floor-standing electronics item whose lights blink while an
 * agent works nearby. Loads the real manifest through the real loader.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { beforeAll, test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import { canPlaceFurniture, rotateFurniture } from '../src/office/editor/editorActions.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import {
  buildDynamicCatalog,
  getAnimationFrames,
  getCatalogByCategory,
  getCatalogEntry,
  getOnStateType,
} from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

let loaded: Awaited<ReturnType<typeof loadFurnitureAssets>>;

beforeAll(async () => {
  loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) });
});

test('server rack loads as electronics that blinks with 3 frames', async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  for (const id of [
    'SERVER_RACK_FRONT_OFF',
    'SERVER_RACK_FRONT_ON_1',
    'SERVER_RACK_FRONT_ON_2',
    'SERVER_RACK_FRONT_ON_3',
  ]) {
    assert.ok(loaded.sprites.has(id), `${id} sprite loaded`);
  }
  assert.ok(
    buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) }),
  );

  const entry = getCatalogEntry('SERVER_RACK_FRONT_OFF');
  assert.ok(entry);
  assert.equal(entry.category, 'electronics');
  assert.ok(!entry.canPlaceOnSurfaces);
  assert.equal(entry.footprintH, 2);
  assert.ok(getCatalogByCategory('electronics').some((e) => e.type === 'SERVER_RACK_FRONT_OFF'));
  assert.ok(!getCatalogByCategory('electronics').some((e) => e.type === 'SERVER_RACK_FRONT_ON_2'));

  const on = getOnStateType('SERVER_RACK_FRONT_OFF');
  assert.notEqual(on, 'SERVER_RACK_FRONT_OFF');
  assert.equal(getAnimationFrames(on)?.length, 3);
});

const COLS = 10;
const ROWS = 8;

function layout(furniture: OfficeLayout['furniture'], areaCols: [number, number]): OfficeLayout {
  return {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: Array.from({ length: COLS * ROWS }, (_, i) =>
      i < COLS || i % COLS === COLS - 1 ? TileType.WALL : TileType.FLOOR_1,
    ),
    furniture,
    areas: [{ label: 'Eng' }],
    areaTiles: Array.from({ length: COLS * ROWS }, (_, i) => {
      const c = i % COLS;
      return c >= areaCols[0] && c <= areaCols[1] ? 'Eng' : null;
    }),
  } as unknown as OfficeLayout;
}

test('rotates through all four directions and stands against a wall', () => {
  let l = layout([{ uid: 'r', type: 'SERVER_RACK_FRONT_OFF', col: 6, row: 0 }], [0, 4]);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    l = rotateFurniture(l, 'r', 'cw');
    seen.push(l.furniture[0].type);
  }
  assert.deepEqual(seen, [
    'SERVER_RACK_SIDE_OFF',
    'SERVER_RACK_BACK_OFF',
    'SERVER_RACK_SIDE_OFF:left',
    'SERVER_RACK_FRONT_OFF',
  ]);
  const empty = layout([], [0, 4]);
  for (const t of seen) assert.ok(canPlaceFurniture(empty, t, 6, 0), `${t} against the top wall`);
});

test("lights up while an agent works in the rack's Area, not another one", () => {
  const lit = (os: OfficeState): boolean => {
    const rack = os.furniture.find(
      (x) =>
        x.sprite === getCatalogEntry('SERVER_RACK_FRONT_ON_1')?.sprite ||
        x.sprite === getCatalogEntry('SERVER_RACK_FRONT_ON_2')?.sprite ||
        x.sprite === getCatalogEntry('SERVER_RACK_FRONT_ON_3')?.sprite,
    );
    return !!rack;
  };
  // Rack in columns 0-4 (Area); the agent has no desk, so it works in place
  const os = new OfficeState(
    layout([{ uid: 'r', type: 'SERVER_RACK_FRONT_OFF', col: 2, row: 2 }], [0, 4]),
  );
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  ch.tileCol = 2;
  ch.tileRow = 5;
  os.setAgentActive(1, true);
  ch.tileCol = 2;
  ch.tileRow = 5;
  os.update(0.6);
  assert.ok(lit(os), 'lit while an agent works in the same Area');
  ch.tileCol = 7; // outside the Area
  os.update(0.6);
  assert.ok(!lit(os), 'dark when the agent works elsewhere');
  os.setAgentActive(1, false);
  ch.tileCol = 2;
  os.update(0.6);
  assert.ok(!lit(os), 'dark when nobody works');
});

test('DGX Spark is a desk-top electronics item that rotates and lights with 3 frames', () => {
  const entry = getCatalogEntry('DGX_SPARK_FRONT_OFF');
  assert.ok(entry);
  assert.equal(entry.category, 'electronics');
  assert.equal(entry.canPlaceOnSurfaces, true);
  assert.equal(entry.footprintH, 1);
  const on = getOnStateType('DGX_SPARK_FRONT_OFF');
  assert.notEqual(on, 'DGX_SPARK_FRONT_OFF');
  assert.equal(getAnimationFrames(on)?.length, 3);

  let l = layout([{ uid: 's', type: 'DGX_SPARK_FRONT_OFF', col: 3, row: 3 }], [0, 4]);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    l = rotateFurniture(l, 's', 'cw');
    seen.push(l.furniture[0].type);
  }
  assert.deepEqual(seen, [
    'DGX_SPARK_SIDE_OFF',
    'DGX_SPARK_BACK_OFF',
    'DGX_SPARK_SIDE_OFF:left',
    'DGX_SPARK_FRONT_OFF',
  ]);
});

test('DGX Spark rack matches the NVL72 size, rotates, and lights with its Area', () => {
  const entry = getCatalogEntry('DGX_SPARK_RACK_FRONT_OFF');
  assert.ok(entry);
  assert.equal(entry.category, 'electronics');
  assert.equal(entry.footprintW, getCatalogEntry('SERVER_RACK_FRONT_OFF')?.footprintW);
  assert.equal(entry.footprintH, getCatalogEntry('SERVER_RACK_FRONT_OFF')?.footprintH);
  assert.equal(getAnimationFrames(getOnStateType('DGX_SPARK_RACK_FRONT_OFF'))?.length, 3);

  const os = new OfficeState(
    layout([{ uid: 'r', type: 'DGX_SPARK_RACK_FRONT_OFF', col: 2, row: 2 }], [0, 4]),
  );
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  os.setAgentActive(1, true);
  ch.tileCol = 2;
  ch.tileRow = 5;
  os.update(0.6);
  const frames = [1, 2, 3].map((n) => getCatalogEntry(`DGX_SPARK_RACK_FRONT_ON_${n}`)?.sprite);
  assert.ok(
    os.furniture.some((x) => frames.includes(x.sprite)),
    'lit while an agent works there',
  );
});
