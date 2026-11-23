/**
 * Monitor glow: a PC screen tints blue (editing), black (shell) or stays
 * green (reading) by the tool of the agent at it. Real assets, real loader.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import path from 'node:path';

import { beforeAll, test } from 'vitest';

import { loadFurnitureAssets } from '../../server/src/assetLoader.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { buildDynamicCatalog, getCatalogEntry } from '../src/office/layout/furnitureCatalog.js';
import { monitorGlowForTool, tintScreen } from '../src/office/monitorGlow.js';
import { setProviderCapabilities } from '../src/office/toolUtils.js';
import type { OfficeLayout } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

beforeAll(async () => {
  const loaded = await loadFurnitureAssets(path.resolve(__dirname, '../public'));
  assert.ok(loaded);
  buildDynamicCatalog({ catalog: loaded.catalog, sprites: Object.fromEntries(loaded.sprites) });
  setProviderCapabilities({ readingTools: ['Read', 'Grep', 'Glob'], subagentToolNames: ['Task'] });
});

test('maps tools to a glow', () => {
  assert.equal(monitorGlowForTool('Bash'), 'shell');
  assert.equal(monitorGlowForTool('Edit'), 'edit');
  assert.equal(monitorGlowForTool('Write'), 'edit');
  assert.equal(monitorGlowForTool('Read'), 'read');
  assert.equal(monitorGlowForTool('Task'), null);
  assert.equal(monitorGlowForTool(null), null);
});

test('tintScreen recolors only the screen pixels, and caches', () => {
  const sprite = getCatalogEntry('PC_FRONT_ON_1')!.sprite;
  const blue = tintScreen(sprite, 'edit');
  assert.notDeepEqual(blue, sprite);
  assert.equal(tintScreen(sprite, 'edit'), blue);
  assert.equal(tintScreen(sprite, 'read'), sprite);
  let changed = 0;
  sprite.forEach((row, y) =>
    row.forEach((px, x) => {
      if (px !== blue[y][x]) changed++;
    }),
  );
  assert.ok(changed > 0 && changed < 60, `only the screen changes (${changed})`);
});

const COLS = 8;
const ROWS = 8;
const layout = {
  version: 1,
  cols: COLS,
  rows: ROWS,
  tiles: Array.from({ length: COLS * ROWS }, () => TileType.FLOOR_1),
  furniture: [
    { uid: 'd', type: 'DESK_FRONT', col: 3, row: 3 },
    { uid: 'p', type: 'PC_FRONT_OFF', col: 3, row: 3 },
    { uid: 'c', type: 'WOODEN_CHAIR_BACK', col: 3, row: 5 },
  ],
} as unknown as OfficeLayout;

test('the screen follows the tool of the agent at the desk and returns to green', () => {
  const os = new OfficeState(layout);
  os.addAgent(1, undefined, undefined, undefined, true);
  const screens = [1, 2, 3].map((n) => getCatalogEntry(`PC_FRONT_ON_${n}`)!.sprite);
  const pc = (): string[][] | undefined => {
    const desk = getCatalogEntry('DESK_FRONT')!.sprite;
    const lit = os.furniture.find((f) => f.x === 3 * 16 && f.y === 3 * 16 && f.sprite !== desk);
    return lit?.sprite;
  };
  const isStock = (s: string[][] | undefined): boolean => screens.includes(s as string[][]);

  os.setAgentActive(1, true);
  os.setAgentTool(1, 'Read');
  assert.ok(isStock(pc()), 'reading keeps the stock green screen');
  os.setAgentTool(1, 'Edit');
  const editing = pc();
  assert.ok(editing && !isStock(editing), 'editing tints the screen');
  os.setAgentTool(1, 'Bash');
  assert.notEqual(pc(), editing, 'shell is a different tint');
  os.setAgentTool(1, null);
  assert.ok(isStock(pc()), 'back to stock when the tool ends');
});
