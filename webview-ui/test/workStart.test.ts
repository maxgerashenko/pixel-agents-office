/**
 * How an agent starts working: it heads for its Area and takes a free
 * computer there first; with every computer taken it pairs on a free seat
 * beside one; with no pairing seat either it vibe codes on its phone inside
 * the Area. On the way it walks on its phone, never "types" standing outside.
 * When the work is done it leaves the Area again.
 *
 * Like officeResting, this drives the OfficeState FSM over simulated time —
 * the order of fallbacks is an invariant e2e can only sample, not pin.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { isOnPhone, isSeatedPose } from '../src/office/engine/characters.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { zoneAt } from '../src/office/engine/seatPlacement.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import { buildDynamicCatalog } from '../src/office/layout/furnitureCatalog.js';
import type { Character, OfficeLayout, PlacedFurniture } from '../src/office/types.js';
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
  ];
  const sprites = Object.fromEntries(catalog.map((a) => [a.id, [[]]]));
  assert.ok(buildDynamicCatalog({ catalog, sprites }));
});

const COLS = 12;
const ROWS = 9;
const AREA = 'Engineering';
const DIR = 'alpha';
/** Area: cols 5–10, rows 0–4. Holds one computer ("pc-seat") and one pairing seat beside it. */
const inArea = (col: number, row: number): boolean => col >= 5 && col <= 10 && row <= 4;
const OUTSIDE = { col: 1, row: 7 };

function f(uid: string, type: string, col: number, row: number): PlacedFurniture {
  return { uid, type, col, row };
}

function layout(): OfficeLayout {
  return {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: new Array<TileType>(COLS * ROWS).fill(TileType.FLOOR_1),
    furniture: [
      f('desk-a', 'DESK', 7, 1),
      f('pc', 'PC', 7, 1),
      f('pc-seat', 'WOODEN_CHAIR', 7, 2), // faces up at the PC: the Area's only computer
      f('desk-b', 'DESK', 8, 1),
      f('desk-c', 'DESK', 9, 1),
      f('pair-seat', 'WOODEN_CHAIR', 9, 2), // same table, no PC in reach: the pairing seat
      f('sofa', 'SOFA', 0, 8), // outside: rest
    ],
    areas: [{ label: AREA }],
    areaTiles: Array.from({ length: COLS * ROWS }, (_, i) =>
      inArea(i % COLS, Math.floor(i / COLS)) ? AREA : null,
    ),
  } as OfficeLayout;
}

function office(): OfficeState {
  const os = new OfficeState(layout());
  os.setAreaMappings({ [DIR]: [AREA] });
  return os;
}

function placeAt(ch: Character, col: number, row: number): void {
  ch.tileCol = col;
  ch.tileRow = row;
  ch.x = col * 16 + 8;
  ch.y = row * 16 + 8;
  ch.path = [];
  ch.state = CharacterState.IDLE;
}

/** Step the office, recording whether `watch` ever worked standing outside the Area. */
function run(os: OfficeState, seconds: number, watch?: Character): { workedOutside: boolean } {
  let workedOutside = false;
  const zone = (ch: Character) => zoneAt(os.layout.areaTiles, COLS, ch.tileCol, ch.tileRow);
  for (let t = 0; t < seconds; t += 0.05) {
    os.update(0.05);
    if (watch && watch.isActive && watch.state === CharacterState.TYPE && zone(watch) === null) {
      workedOutside = true;
    }
  }
  return { workedOutside };
}

/** Agent 1 holds the Area's computer and is working at it. */
function withPcTaken(): OfficeState {
  const os = office();
  os.addAgent(1, undefined, undefined, undefined, true, DIR);
  assert.equal(os.characters.get(1)!.seatId, 'pc-seat');
  os.setAgentActive(1, true);
  run(os, 1);
  return os;
}

test('a working agent with its own computer walks there on its phone, then sits and types', () => {
  const os = office();
  os.addAgent(1, undefined, undefined, undefined, true, DIR);
  const ch = os.characters.get(1)!;
  placeAt(ch, OUTSIDE.col, OUTSIDE.row);
  os.setAgentActive(1, true);
  os.update(0.05);
  assert.equal(ch.state, CharacterState.WALK);
  assert.ok(isOnPhone(ch), 'vibe codes on the phone while walking to work');
  const { workedOutside } = run(os, 10, ch);
  assert.ok(!workedOutside);
  assert.deepEqual([ch.tileCol, ch.tileRow], [7, 2]);
  assert.equal(ch.state, CharacterState.TYPE);
  assert.ok(isSeatedPose(ch) && !isOnPhone(ch), 'at the computer it types, seated');
});

test('every computer taken: it pairs on the seat beside the busy one', () => {
  const os = withPcTaken();
  os.addAgent(2, undefined, undefined, undefined, true, DIR);
  const ch = os.characters.get(2)!;
  assert.equal(ch.seatId, null);
  placeAt(ch, OUTSIDE.col, OUTSIDE.row);
  os.setAgentActive(2, true);
  const { workedOutside } = run(os, 10, ch);
  assert.ok(!workedOutside, 'never works standing outside the Area');
  assert.equal(ch.workSpot?.kind, 'pair');
  assert.deepEqual([ch.tileCol, ch.tileRow], [9, 2]);
  assert.ok(isSeatedPose(ch) && !isOnPhone(ch));
});

test('no computer and no pairing seat: it vibe codes on its phone inside the Area', () => {
  const os = withPcTaken();
  os.addAgent(2, undefined, undefined, undefined, true, DIR);
  os.setAgentActive(2, true);
  run(os, 10);
  assert.equal(os.characters.get(2)!.workSpot?.kind, 'pair');

  os.addAgent(3, undefined, undefined, undefined, true, DIR);
  const ch = os.characters.get(3)!;
  placeAt(ch, OUTSIDE.col, OUTSIDE.row);
  os.setAgentActive(3, true);
  const { workedOutside } = run(os, 10, ch);
  assert.ok(!workedOutside);
  assert.equal(ch.workSpot?.kind, 'phone');
  assert.ok(
    inArea(ch.tileCol, ch.tileRow),
    `phones inside the Area, at ${ch.tileCol},${ch.tileRow}`,
  );
  assert.equal(ch.state, CharacterState.TYPE);
  assert.ok(isOnPhone(ch) && !isSeatedPose(ch), 'standing on the phone, not seated typing');
});

test('a computer coming free is taken over the pairing seat', () => {
  const os = withPcTaken();
  os.addAgent(2, undefined, undefined, undefined, true, DIR);
  const ch = os.characters.get(2)!;
  os.setAgentActive(2, true);
  run(os, 10);
  assert.equal(ch.workSpot?.kind, 'pair');
  os.removeAgent(1);
  run(os, 10);
  assert.equal(ch.seatId, 'pc-seat');
  assert.equal(ch.workSpot ?? null, null);
  assert.deepEqual([ch.tileCol, ch.tileRow], [7, 2]);
  assert.ok(isSeatedPose(ch));
});

test('a seat coming free is taken by an agent already standing on its phone', () => {
  const os = withPcTaken();
  os.addAgent(2, undefined, undefined, undefined, true, DIR);
  os.setAgentActive(2, true);
  run(os, 10);
  os.addAgent(3, undefined, undefined, undefined, true, DIR);
  const ch = os.characters.get(3)!;
  os.setAgentActive(3, true);
  run(os, 10);
  assert.equal(ch.workSpot?.kind, 'phone');
  const pairing = os.characters.get(2)!;
  os.removeAgent(1);
  run(os, 15);
  // One of the two takes the freed computer, the other moves up to the pairing seat
  const seated = [pairing, ch].filter((c) => c.seatId === 'pc-seat');
  assert.equal(seated.length, 1);
  assert.ok(!isOnPhone(ch) && isSeatedPose(ch));
  assert.ok(!isOnPhone(pairing) && isSeatedPose(pairing));
});

test('a computer its idle owner left is taken by a standing worker', () => {
  const os = withPcTaken();
  os.addAgent(2, undefined, undefined, undefined, true, DIR);
  os.setAgentActive(2, true);
  run(os, 10);
  const ch = os.characters.get(2)!;
  assert.equal(ch.workSpot?.kind, 'pair');
  os.setAgentActive(1, false);
  run(os, 30);
  assert.equal(ch.seatId, 'pc-seat');
  assert.equal(ch.workSpot ?? null, null);
  assert.deepEqual([ch.tileCol, ch.tileRow], [7, 2]);
  assert.equal(os.characters.get(1)!.seatId, null, 'the idle owner gave the computer up');
  // The owner works again: no computer left, so it pairs instead of sitting on top of ch
  os.setAgentActive(1, true);
  run(os, 15);
  assert.equal(os.characters.get(1)!.workSpot?.kind, 'pair');
  assert.equal(ch.seatId, 'pc-seat');
});

test('work done: the agent gives its spot up and leaves the Area', () => {
  const os = withPcTaken();
  os.addAgent(2, undefined, undefined, undefined, true, DIR);
  const ch = os.characters.get(2)!;
  os.setAgentActive(2, true);
  run(os, 10);
  assert.equal(ch.workSpot?.kind, 'pair');
  os.setAgentActive(2, false);
  run(os, 15);
  assert.equal(ch.workSpot ?? null, null);
  assert.ok(!inArea(ch.tileCol, ch.tileRow), `left the Area, at ${ch.tileCol},${ch.tileRow}`);
  assert.ok(!isOnPhone(ch));
});

test('an unmapped agent with no computer outside the Areas phones outside them, never inside', () => {
  const os = office();
  os.addAgent(1, undefined, undefined, undefined, true);
  const ch = os.characters.get(1)!;
  assert.equal(ch.seatId, null, 'the only computer is inside the Area');
  placeAt(ch, OUTSIDE.col, OUTSIDE.row);
  os.setAgentActive(1, true);
  run(os, 10);
  assert.equal(ch.workSpot?.kind, 'phone');
  assert.ok(!inArea(ch.tileCol, ch.tileRow));
  assert.ok(isOnPhone(ch));
});
