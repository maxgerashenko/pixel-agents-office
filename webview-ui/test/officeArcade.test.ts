/**
 * Arcade machines: idle agents stand in front of one and play, never inside a
 * marked Area or its buffer, one agent per machine, and work wins over play.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { canPlaceFurniture, rotateFurniture } from '../src/office/editor/editorActions.js';
import {
  characterDrawOffsetY,
  getCharacterSprite,
  isSeatedPose,
} from '../src/office/engine/characters.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import type { LoadedAssetData } from '../src/office/layout/furnitureCatalog.js';
import {
  buildDynamicCatalog,
  getCatalogByCategory,
} from '../src/office/layout/furnitureCatalog.js';
import type { CharacterSprites } from '../src/office/sprites/spriteData.js';
import type { OfficeLayout, PlacedFurniture } from '../src/office/types.js';
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

/** Front, back and side machines (like the manifest: 1×2, the top row is
 *  background), each with an off state and a two-frame on animation. */
function arcadeAssets(): CatalogAsset[] {
  const out: CatalogAsset[] = [];
  for (const o of ['front', 'back', 'side']) {
    const O = o.toUpperCase();
    const base = {
      height: 32,
      footprintH: 2,
      backgroundTiles: 1,
      groupId: 'ARCADE_MACHINE',
      orientation: o,
      ...(o === 'side' ? { mirrorSide: true } : {}),
    };
    out.push(asset(`ARCADE_MACHINE_${O}_OFF`, 'electronics', { ...base, state: 'off' }));
    for (const frame of [0, 1]) {
      out.push(
        asset(`ARCADE_MACHINE_${O}_ON_${frame + 1}`, 'electronics', {
          ...base,
          state: 'on',
          animationGroup: `arcade-${o}`,
          frame,
        }),
      );
    }
  }
  return out;
}

beforeAll(() => {
  const catalog = [
    asset('DESK', 'desks', { isDesk: true }),
    asset('PC', 'electronics', { canPlaceOnSurfaces: true }),
    asset('WOODEN_CHAIR', 'chairs'),
    ...arcadeAssets(),
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
    // Top row and right column are walls
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

function idleAgent(os: OfficeState, id: number): void {
  os.addAgent(id, undefined, undefined, undefined, true);
  os.setAgentActive(id, false);
}

test('a play spot sits just below the machine', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)]));
  assert.deepEqual(
    [...os.playSpots.entries()].map(([k, v]) => [k, v.col, v.row]),
    [['play:arc', 6, 2]],
  );
});

test('no play spot for a machine whose front is in an Area buffer', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)], [5, 7]));
  assert.equal(os.playSpots.size, 0);
});

test('idle agents play at the machine, one per machine, facing it', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)]));
  idleAgent(os, 1);
  idleAgent(os, 2);
  let played = false;
  simulate(os, 1500, () => {
    const players = [...os.characters.values()].filter((c) => c.playSpotId);
    assert.ok(players.length <= 1, 'one agent per machine');
    for (const c of players) {
      if (c.state === CharacterState.TYPE) {
        played = true;
        assert.deepEqual([c.tileCol, c.tileRow], [6, 2]);
        assert.equal(c.dir, Direction.UP);
      }
    }
  });
  assert.ok(played, 'an agent played');
});

test('a playing agent that becomes active leaves the machine for its computer', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)]));
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

test('a machine stands like a plant: cabinet top over the wall, body on the floor', () => {
  const l = layout([]);
  assert.ok(canPlaceFurniture(l, 'ARCADE_MACHINE_FRONT_OFF', 6, 0), 'top tile on the top wall');
  assert.ok(canPlaceFurniture(l, 'ARCADE_MACHINE_FRONT_OFF', 6, 3), 'free-standing in the room');
  assert.ok(!canPlaceFurniture(l, 'ARCADE_MACHINE_FRONT_OFF', COLS - 1, 3), 'body on a wall');
  for (const type of [
    'ARCADE_MACHINE_SIDE_OFF',
    'ARCADE_MACHINE_SIDE_OFF:left',
    'ARCADE_MACHINE_BACK_OFF',
  ]) {
    assert.ok(canPlaceFurniture(l, type, 6, 0), `${type} against the top wall`);
  }
});

test('one arcade in the Tech palette, rotating through all four directions', () => {
  const arcades = getCatalogByCategory('electronics').filter((e) => /ARCADE/.test(e.type));
  assert.deepEqual(
    arcades.map((e) => e.type),
    ['ARCADE_MACHINE_FRONT_OFF'],
  );
  let l = layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)]);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    l = rotateFurniture(l, 'arc', 'cw');
    seen.push(l.furniture.find((x) => x.uid === 'arc')!.type);
  }
  assert.deepEqual(seen, [
    'ARCADE_MACHINE_SIDE_OFF',
    'ARCADE_MACHINE_BACK_OFF',
    'ARCADE_MACHINE_SIDE_OFF:left',
    'ARCADE_MACHINE_FRONT_OFF',
  ]);
});

test('the player stands at the screen and faces it, in every rotation', () => {
  const cases: Array<[string, number, number, Direction]> = [
    ['ARCADE_MACHINE_FRONT_OFF', 5, 5, Direction.UP],
    ['ARCADE_MACHINE_SIDE_OFF', 6, 4, Direction.LEFT],
    ['ARCADE_MACHINE_BACK_OFF', 5, 3, Direction.DOWN],
    ['ARCADE_MACHINE_SIDE_OFF:left', 4, 4, Direction.RIGHT],
  ];
  for (const [type, col, row, dir] of cases) {
    const os = new OfficeState(layout([f('arc', type, 5, 3)]));
    assert.deepEqual(
      [...os.playSpots.values()].map((v) => [v.col, v.row, v.dir]),
      [[col, row, dir]],
      type,
    );
  }
});

test('a left-facing machine stays mirrored while it is lit', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_SIDE_OFF:left', 5, 3)]));
  const machine = () => os.furniture.find((i) => i.x === 5 * 16 && i.y === 3 * 16);
  assert.equal(machine()?.mirrored, true);
  idleAgent(os, 1);
  const ch = os.characters.get(1)!;
  for (let t = 0; t < 1500 && !(ch.playSpotId && ch.state === CharacterState.TYPE); t += 0.05) {
    os.update(0.05);
  }
  assert.ok(ch.playSpotId, 'agent started playing');
  assert.equal(ch.dir, Direction.RIGHT);
  assert.equal(characterDrawOffsetY(ch), 8, 'feet on the cabinet base line');
  simulate(os, 0.5, () => {
    const m = machine()!;
    assert.equal(m.mirrored, true, `${String(m.sprite[0][0])} faces the player`);
  });
  assert.notEqual(machine()?.sprite[0][0], 'ARCADE_MACHINE_SIDE_OFF', 'lit while playing');
});

test('the machine lights up and animates while an agent plays, and goes dark after', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)]));
  const screen = () => os.furniture.find((i) => i.x === 6 * 16 && i.y === 0)?.sprite[0][0];
  assert.equal(screen(), 'ARCADE_MACHINE_FRONT_OFF');
  idleAgent(os, 1);
  const ch = os.characters.get(1)!;
  for (let t = 0; t < 1500 && !(ch.playSpotId && ch.state === CharacterState.TYPE); t += 0.05) {
    os.update(0.05);
  }
  assert.ok(ch.playSpotId, 'agent started playing');
  const frames = new Set<string | undefined>();
  simulate(os, 0.5); // the screen refreshes on the next animation tick
  simulate(os, 2, () => frames.add(screen()));
  assert.ok(!frames.has('ARCADE_MACHINE_FRONT_OFF'), 'lit while playing');
  assert.ok(frames.size > 1, 'screen animates');
  os.setAgentActive(1, true);
  simulate(os, 30);
  assert.equal(screen(), 'ARCADE_MACHINE_FRONT_OFF');
});

test('a player stands at the machine: standing arcade frames, never the seated typing ones', () => {
  const os = new OfficeState(layout([f('arc', 'ARCADE_MACHINE_FRONT_OFF', 6, 0)]));
  idleAgent(os, 1);
  const ch = os.characters.get(1)!;
  for (let t = 0; t < 1500 && !(ch.playSpotId && ch.state === CharacterState.TYPE); t += 0.05) {
    os.update(0.05);
  }
  assert.ok(ch.playSpotId, 'agent started playing');
  assert.equal(isSeatedPose(ch), false);
  const tag = (name: string) => [[[name]], [[name]]];
  const set = (name: string) =>
    Object.fromEntries(Object.values(Direction).map((d) => [d, tag(name)]));
  const sprites = {
    walk: set('walk'),
    typing: set('typing'),
    reading: set('reading'),
    phoneWalk: set('phoneWalk'),
    phone: set('phone'),
    paddle: set('paddle'),
    arcade: set('arcade'),
  } as unknown as CharacterSprites;
  assert.equal(getCharacterSprite(ch, sprites)[0][0], 'arcade');
});
