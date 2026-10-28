/**
 * Unit tests for the pure layout-editor rules in editorActions.ts that the e2e
 * specs can only reach through a real VS Code window.
 *
 * The catalog is a hand-built slice of the bundled assets with the same
 * footprints, background rows and rotation groups: DESK is 2-way (front 3x2 ↔
 * side 1x4), PC rotates front → side, COFFEE and WOODEN_CHAIR_FRONT don't.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, describe, test } from 'vitest';

import { diffAreaRenames, renameAreaInMappings } from '../../core/src/areaRenames.js';
import { rotateFurniture } from '../src/office/editor/editorActions.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout, PlacedFurniture } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

type CatalogAsset = LoadedAssetData['catalog'][number];

function asset(
  id: string,
  footprintW: number,
  footprintH: number,
  extra: Partial<CatalogAsset> = {},
): CatalogAsset {
  return {
    id,
    label: id,
    category: 'misc',
    width: footprintW * 16,
    height: footprintH * 16,
    footprintW,
    footprintH,
    isDesk: false,
    ...extra,
  };
}

beforeAll(() => {
  const catalog = [
    asset('DESK_FRONT', 3, 2, {
      isDesk: true,
      groupId: 'DESK',
      orientation: 'front',
      rotationScheme: '2-way',
      backgroundTiles: 1,
    }),
    asset('DESK_SIDE', 1, 4, {
      isDesk: true,
      groupId: 'DESK',
      orientation: 'side',
      rotationScheme: '2-way',
      backgroundTiles: 1,
    }),
    asset('PC_FRONT_OFF', 1, 2, {
      groupId: 'PC',
      orientation: 'front',
      canPlaceOnSurfaces: true,
      backgroundTiles: 1,
    }),
    asset('PC_SIDE', 1, 2, {
      groupId: 'PC',
      orientation: 'side',
      canPlaceOnSurfaces: true,
      backgroundTiles: 1,
    }),
    asset('COFFEE', 1, 1, { canPlaceOnSurfaces: true }),
    asset('WOODEN_CHAIR_FRONT', 1, 2, { backgroundTiles: 1 }),
  ];
  const sprites = Object.fromEntries(catalog.map((a) => [a.id, [['']]]));
  assert.ok(buildDynamicCatalog({ catalog, sprites }));
});

function floorLayout(cols: number, rows: number, furniture: PlacedFurniture[]): OfficeLayout {
  return {
    version: 1,
    cols,
    rows,
    tiles: new Array(cols * rows).fill(TileType.FLOOR_1),
    furniture,
  };
}

describe('rotateFurniture validates the whole desk group', () => {
  test('a desk with a PC on it rotates both when the group fits', () => {
    const layout = floorLayout(12, 12, [
      { uid: 'desk', type: 'DESK_FRONT', col: 3, row: 3 },
      { uid: 'pc', type: 'PC_FRONT_OFF', col: 4, row: 3 },
    ]);
    const rotated = rotateFurniture(layout, 'desk', 'cw');
    assert.notEqual(rotated, layout);
    assert.deepEqual(
      rotated.furniture.map((f) => `${f.uid}:${f.type}@${f.col},${f.row}`),
      ['desk:DESK_SIDE@3,3', 'pc:PC_SIDE@3,4'],
    );
  });

  test('refused when a rider would land on another item, though the desk fits', () => {
    // The side desk's top row is a background row, so it may share (3,3) with
    // the chair's solid row; the coffee swung onto (3,3) may not.
    const layout = floorLayout(12, 12, [
      { uid: 'desk', type: 'DESK_FRONT', col: 3, row: 3 },
      { uid: 'coffee', type: 'COFFEE', col: 5, row: 3 },
      { uid: 'chair', type: 'WOODEN_CHAIR_FRONT', col: 3, row: 2 },
    ]);
    assert.equal(rotateFurniture(layout, 'desk', 'cw'), layout);
  });

  test('the same desk without the coffee rotates — only the rider was in the way', () => {
    const layout = floorLayout(12, 12, [
      { uid: 'desk', type: 'DESK_FRONT', col: 3, row: 3 },
      { uid: 'chair', type: 'WOODEN_CHAIR_FRONT', col: 3, row: 2 },
    ]);
    const rotated = rotateFurniture(layout, 'desk', 'cw');
    assert.equal(rotated.furniture.find((f) => f.uid === 'desk')?.type, 'DESK_SIDE');
  });

  test('refused when the rotated group would leave the grid', () => {
    // A 1x4 side desk at row 10 of a 12-row grid covers rows 10-13.
    const layout = floorLayout(12, 12, [
      { uid: 'desk', type: 'DESK_FRONT', col: 3, row: 10 },
      { uid: 'pc', type: 'PC_FRONT_OFF', col: 4, row: 10 },
    ]);
    assert.equal(rotateFurniture(layout, 'desk', 'cw'), layout);
  });
});

describe('diffAreaRenames', () => {
  const areas = (...labels: string[]) => labels.map((label) => ({ label, color: 'teal' }));
  const layoutOf = (labels: string[], tiles: Array<string | null> = []) => ({
    areas: areas(...labels),
    areaTiles: tiles,
  });

  test('detects a rename', () => {
    assert.deepEqual(diffAreaRenames(layoutOf(['A', 'B']), layoutOf(['A', 'C'])), [['B', 'C']]);
  });

  test('undo direction yields the reverse pair', () => {
    assert.deepEqual(diffAreaRenames(layoutOf(['A', 'C']), layoutOf(['A', 'B'])), [['C', 'B']]);
  });

  test('rename plus add in one diff is still a rename (tile match)', () => {
    const prev = layoutOf(['A'], ['A', 'A', null]);
    const next = layoutOf(['New', 'B'], ['B', 'B', null]);
    assert.deepEqual(diffAreaRenames(prev, next), [['A', 'B']]);
  });

  test('rename plus add pairs by index when tiles are empty', () => {
    assert.deepEqual(diffAreaRenames(layoutOf(['A', 'B']), layoutOf(['A', 'C', 'D'])), [
      ['B', 'C'],
    ]);
  });

  test('rename plus remove', () => {
    const prev = layoutOf(['A', 'B', 'C'], ['B', 'B', 'C']);
    const next = layoutOf(['X', 'A'], ['X', 'X', null]);
    assert.deepEqual(diffAreaRenames(prev, next), [['B', 'X']]);
  });

  test('tile sets win over index position', () => {
    const prev = layoutOf(['P', 'Q'], ['P', 'Q']);
    const next = layoutOf(['N2', 'N1'], ['N1', 'N2']);
    assert.deepEqual(
      diffAreaRenames(prev, next).sort(),
      [
        ['P', 'N1'],
        ['Q', 'N2'],
      ].sort(),
    );
  });

  test('pure add, pure remove, swap, reorder and no change yield nothing', () => {
    assert.deepEqual(diffAreaRenames(layoutOf(['A']), layoutOf(['A', 'B'])), []);
    assert.deepEqual(diffAreaRenames(layoutOf(['A', 'B']), layoutOf(['A'])), []);
    assert.deepEqual(diffAreaRenames(layoutOf(['A', 'B']), layoutOf(['B', 'A'])), []);
    assert.deepEqual(diffAreaRenames(layoutOf(['A', 'B']), layoutOf(['A', 'B'])), []);
  });

  test('differing tile sets still pair by index', () => {
    const prev = layoutOf(['A', 'B'], ['A', 'B']);
    const next = layoutOf(['A', 'C'], ['A', null, 'C']);
    // Tile sets differ, but index 1 matches: treated as a rename by position.
    assert.deepEqual(diffAreaRenames(prev, next), [['B', 'C']]);
  });

  test('empty or missing areas yield nothing', () => {
    assert.deepEqual(diffAreaRenames({}, {}), []);
    assert.deepEqual(diffAreaRenames(undefined, layoutOf(['A'])), []);
    assert.deepEqual(diffAreaRenames(layoutOf(['A']), undefined), []);
    assert.deepEqual(diffAreaRenames(layoutOf([]), layoutOf(['A'])), []);
  });
});

describe('renameAreaInMappings', () => {
  test('rewrites label values across directories, keys untouched', () => {
    const next = renameAreaInMappings({ web: ['A', 'B'], api: ['B'], docs: ['A'] }, [['B', 'C']]);
    assert.deepEqual(next, { web: ['A', 'C'], api: ['C'], docs: ['A'] });
  });

  test('dedupes when a directory already had the new label', () => {
    const next = renameAreaInMappings({ web: ['C', 'B', 'D'] }, [['B', 'C']]);
    assert.deepEqual(next, { web: ['C', 'D'] });
  });

  test('returns the same reference when nothing changed', () => {
    const mappings = { web: ['A'] };
    assert.equal(renameAreaInMappings(mappings, [['X', 'Y']]), mappings);
    assert.equal(renameAreaInMappings(mappings, []), mappings);
  });
});
