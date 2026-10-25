/**
 * Where agents work: only at seats that face a computer, whatever the chair
 * type. Sofas, benches and dining chairs are never auto-assigned; with every
 * computer taken an agent works standing.
 *
 * Like teammateSeating and greeter, this tests the OfficeState domain model —
 * seat roles and the stage order of the picker are invariants e2e can only
 * sample, not pin.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { OfficeState } from '../src/office/engine/officeState.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import type { OfficeLayout, PlacedFurniture } from '../src/office/types.js';
import { TileType } from '../src/office/types.js';

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
      // A bench is a work seat when it faces a computer
      f('wb-desk', 'DESK', 9, 1),
      f('wb-pc', 'PC', 9, 1),
      f('wb', 'WOODEN_BENCH', 9, 2),
      f('near-sofa', 'SOFA', 1, 3), // right beside w1, but faces no computer
      f('dining', 'WOODEN_CHAIR', 8, 5), // faces no computer
      f('sofa', 'SOFA', 1, 5),
      f('bench', 'WOODEN_BENCH', 3, 5), // faces no computer
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

function seatOf(os: OfficeState, id: number): string | null {
  return os.characters.get(id)!.seatId;
}

const WORK = ['w1', 'w2', 'w3', 'wb'];

test('seat roles: only seats facing a computer are work seats, bench or not', () => {
  const os = new OfficeState(layout());
  assert.deepEqual(
    [
      'w1',
      'w2',
      'w3',
      'wb',
      'dining',
      'sofa',
      'near-sofa',
      'bench',
      'cushioned',
      'sofa-in-area',
    ].filter((uid) => os.isWorkSeat(uid)),
    WORK,
  );
});

test('an agent never gets a sofa or dining chair — with every computer taken it works standing', () => {
  const os = new OfficeState(layout(false));
  for (let id = 1; id <= 5; id++) os.addAgent(id, undefined, undefined, undefined, true);
  const seats = [1, 2, 3, 4].map((id) => seatOf(os, id)).sort();
  assert.deepEqual(seats, WORK);
  assert.equal(seatOf(os, 5), null, 'the fifth agent works standing');
});

test('a persisted seat that is not a work seat is not restored', () => {
  const os = new OfficeState(layout());
  os.addAgent(1, undefined, undefined, 'sofa', true);
  assert.ok(WORK.includes(seatOf(os, 1)!));
  const os2 = new OfficeState(layout());
  os2.addAgent(1, undefined, undefined, 'w3', true);
  assert.equal(seatOf(os2, 1), 'w3', 'a persisted work seat is still honored');
});

test('teammates cluster onto the closest work seat, never a closer sofa', () => {
  const os = new OfficeState(layout(false));
  os.addAgent(1, undefined, undefined, 'w1', true);
  os.addAgent(2, undefined, undefined, undefined, true, undefined, 1);
  assert.equal(seatOf(os, 2), 'w2');
  // Every computer taken: the teammate stands beside its lead, not on a sofa
  os.addAgent(3, undefined, undefined, undefined, true, undefined, 1);
  os.addAgent(4, undefined, undefined, undefined, true, undefined, 1);
  os.addAgent(5, undefined, undefined, undefined, true, undefined, 1);
  assert.equal(seatOf(os, 5), null);
});

test('rebuildFromLayout reassigns an agent whose computer was removed', () => {
  const os = new OfficeState(layout(false));
  os.addAgent(1, undefined, undefined, 'w1', true);
  assert.equal(seatOf(os, 1), 'w1');
  const edited = layout(false);
  edited.furniture = edited.furniture.filter((item) => item.uid !== 'w1-pc');
  os.rebuildFromLayout(edited);
  assert.ok(!os.isWorkSeat('w1'));
  assert.ok(['w2', 'w3', 'wb'].includes(seatOf(os, 1)!), `now at ${seatOf(os, 1)}`);
  assert.equal(os.seats.get('w1')!.assigned, false);
});

test('a seat the user picked by hand survives a layout edit; sub-agents never take seats', () => {
  const os = new OfficeState(layout(false));
  os.addAgent(1, undefined, undefined, 'w1', true);
  os.reassignSeat(1, 'sofa');
  assert.equal(seatOf(os, 1), 'sofa');
  const sub = os.addSubagent(1, 'tool-1');
  os.rebuildFromLayout(layout(false));
  assert.equal(seatOf(os, 1), 'sofa', 'an unrelated edit leaves the manual seat alone');
  assert.equal(os.characters.get(sub)!.seatId, null, 'sub-agents are never seated');
});

test('a mapped agent prefers a work seat inside its Area, then falls back to the rest', () => {
  const os = new OfficeState(layout());
  os.setAreaMappings({ alpha: [AREA] });

  os.addAgent(1, undefined, undefined, undefined, true, 'alpha');
  assert.equal(seatOf(os, 1), 'w2');
  // The Area's only computer is taken: the next alpha agent works elsewhere
  os.addAgent(2, undefined, undefined, undefined, true, 'alpha');
  assert.ok(['w1', 'w3', 'wb'].includes(seatOf(os, 2)!));
});

test('an unmapped agent takes work seats outside every Area before one inside', () => {
  const os = new OfficeState(layout());
  for (let id = 1; id <= 3; id++) os.addAgent(id, undefined, undefined, undefined, true);
  assert.deepEqual([1, 2, 3].map((id) => seatOf(os, id)).sort(), ['w1', 'w3', 'wb']);
  os.addAgent(4, undefined, undefined, undefined, true);
  assert.equal(seatOf(os, 4), 'w2');
});

test('a mapping to an Area painted nowhere counts as no mapping', () => {
  const os = new OfficeState(layout());
  os.setAreaMappings({ alpha: ['Nowhere'] });
  os.addAgent(1, undefined, undefined, undefined, true, 'alpha');
  assert.ok(['w1', 'w3', 'wb'].includes(seatOf(os, 1)!));
});
