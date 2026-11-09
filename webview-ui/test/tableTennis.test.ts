/**
 * Table tennis: bored idle agents walk to a table and play 1v1, never at a
 * table whose ends are in a marked Area, and work always ends the game.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { beforeAll, test } from 'vitest';

import { TABLE_TENNIS_BALL_BOUNCE_AT, TABLE_TENNIS_BALL_CROSS_SEC } from '../src/constants.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import {
  advanceTableGame,
  gameWinner,
  newTableGame,
  nextServer,
  scorePoint,
  swingFrame,
  tableBall,
} from '../src/office/engine/tableTennis.js';
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
    asset('TABLE_TENNIS', 'misc', { width: 48, height: 32, footprintW: 3, footprintH: 2 }),
  ];
  const sprites = Object.fromEntries(catalog.map((a) => [a.id, [[]]]));
  assert.ok(buildDynamicCatalog({ catalog, sprites }));
});

const COLS = 12;
const ROWS = 8;

function f(uid: string, type: string, col: number, row: number): PlacedFurniture {
  return { uid, type, col, row };
}

/** Table at cols 4–6 (ends at 3 and 7), rows 4–5; one workstation for seats. */
function layout(areaOverTable = false): OfficeLayout {
  return {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: new Array<TileType>(COLS * ROWS).fill(TileType.FLOOR_1),
    furniture: [
      f('desk', 'DESK', 1, 1),
      f('pc', 'PC', 1, 1),
      f('chair', 'WOODEN_CHAIR', 1, 2),
      f('tt', 'TABLE_TENNIS', 4, 4),
    ],
    ...(areaOverTable
      ? {
          areas: [{ label: 'Engineering' }],
          areaTiles: Array.from({ length: COLS * ROWS }, (_, i) =>
            i % COLS >= 2 && i % COLS <= 8 && Math.floor(i / COLS) >= 3 ? 'Engineering' : null,
          ),
        }
      : {}),
  } as OfficeLayout;
}

function addIdleAgent(os: OfficeState, id: number): void {
  os.addAgent(id, undefined, undefined, undefined, true);
  os.setAgentActive(id, false);
}

function simulate(os: OfficeState, seconds: number, onTick?: () => void): void {
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) {
    os.update(dt);
    onTick?.();
  }
}

test('a table with both ends outside every Area is a tennis table; one in an Area is not', () => {
  assert.equal(new OfficeState(layout()).tennisTables.length, 1);
  assert.equal(new OfficeState(layout(true)).tennisTables.length, 0);
});

test('two idle agents meet at a table, face each other and rally with a ball', () => {
  const os = new OfficeState(layout());
  addIdleAgent(os, 1);
  addIdleAgent(os, 2);
  let rallied = false;
  let sawBall = false;
  let swung = false;
  let sawScore = false;
  simulate(os, 3000, () => {
    const players = [...os.characters.values()].filter((c) => c.playing);
    if (players.length === 2) {
      rallied = true;
      const [a, b] = players.sort((x, y) => x.tileCol - y.tileCol);
      assert.equal(a.state, CharacterState.TYPE);
      assert.deepEqual([a.tileCol, a.tileRow], [3, 5], 'left end, level with the centre line');
      assert.deepEqual([b.tileCol, b.tileRow], [7, 5], 'right end, level with the centre line');
      if (a.frame === 1 || b.frame === 1) swung = true;
      assert.notEqual(a.dir, b.dir, 'players face each other');
      if (os.getTableTennisBalls().length === 1) sawBall = true;
      if (os.getTableTennisScores().length === 1) sawScore = true;
    }
    const claims = [...os.characters.values()]
      .map((c) => (c.playSlot ? `${c.playSlot.tableUid}:${c.playSlot.index}` : null))
      .filter(Boolean);
    assert.equal(new Set(claims).size, claims.length, 'one agent per table end');
  });
  assert.ok(rallied, 'two agents played');
  assert.ok(sawBall, 'a ball was in play');
  assert.ok(swung, 'players swung their paddles');
  assert.ok(sawScore, 'the score showed over the net');
});

test('the ball leaves a paddle, bounces on the far half and reaches the other paddle', () => {
  const os = new OfficeState(layout());
  const table = os.tennisTables[0];
  const at = (sec: number) => tableBall(table, sec);
  assert.equal(at(0).x, table.ballLeftX);
  assert.ok(at(0).z > 0, 'hit above the table');
  assert.equal(at(0).near[0], 1);
  const bounce = at(TABLE_TENNIS_BALL_CROSS_SEC * TABLE_TENNIS_BALL_BOUNCE_AT);
  assert.ok(Math.abs(bounce.z) < 1e-9, 'touches the table');
  assert.ok(bounce.x > (table.ballLeftX + table.ballRightX) / 2, 'on the far half');
  const back = at(TABLE_TENNIS_BALL_CROSS_SEC);
  assert.ok(Math.abs(back.x - table.ballRightX) < 1e-9);
  assert.equal(swingFrame(back.near[1]), 1, 'receiver swings as it arrives');
  assert.equal(swingFrame(back.near[0]), 0, 'server is back to ready');
});

test('a lone agent gives up waiting for an opponent and carries on', () => {
  const os = new OfficeState(layout());
  addIdleAgent(os, 1);
  const ch = os.characters.get(1)!;
  let waited = false;
  let left = false;
  simulate(os, 3000, () => {
    if (ch.playSlot && ch.state === CharacterState.TYPE && !ch.playing) waited = true;
    if (waited && !ch.playSlot) left = true;
    assert.equal(os.getTableTennisBalls().length, 0, 'no ball without an opponent');
  });
  assert.ok(waited, 'agent went to the table');
  assert.ok(left, 'agent gave up the table');
});

test('a player that becomes active leaves the game and walks to work', () => {
  const os = new OfficeState(layout());
  addIdleAgent(os, 1);
  addIdleAgent(os, 2);
  for (let t = 0; t < 3000 && ![...os.characters.values()].every((c) => c.playing); t += 0.05) {
    os.update(0.05);
  }
  const ch = os.characters.get(1)!;
  assert.ok(ch.playing, 'game on');
  os.setAgentActive(1, true);
  simulate(os, 30);
  assert.equal(ch.playSlot ?? null, null);
  assert.equal(ch.playing, false);
  const seat = os.seats.get(ch.seatId!)!;
  assert.deepEqual([ch.tileCol, ch.tileRow], [seat.seatCol, seat.seatRow]);
});

test('a game goes to 11, won by 2', () => {
  assert.equal(gameWinner([11, 9]), 0);
  assert.equal(gameWinner([3, 11]), 1);
  assert.equal(gameWinner([11, 10]), null, 'must win by 2');
  assert.equal(gameWinner([10, 10]), null);
  assert.equal(gameWinner([14, 12]), 0, 'deuce runs on past 11');
  assert.equal(gameWinner([12, 13]), null);
});

test('serve passes every two points, every point from deuce', () => {
  assert.deepEqual(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ].map((s) => nextServer(s as [number, number])),
    [0, 0, 1, 1, 0],
  );
  assert.equal(nextServer([10, 10]), 0);
  assert.equal(nextServer([11, 10]), 1);
  assert.equal(nextServer([11, 11]), 0);
});

test('random points play out to a legal final score, then the players leave', () => {
  for (let run = 0; run < 50; run++) {
    const game = newTableGame();
    let verdict = 'playing';
    let finalScore: [number, number] | null = null;
    for (let t = 0; t < 3600 && verdict === 'playing'; t += 0.05) {
      verdict = advanceTableGame(game, 2, 0.05);
      if (game.winner !== null) finalScore = [game.scores[0], game.scores[1]];
    }
    assert.equal(verdict, 'finished');
    assert.ok(finalScore);
    const [a, b] = finalScore;
    assert.ok(Math.max(a, b) >= 11 && Math.abs(a - b) >= 2, `final ${a}-${b}`);
    assert.ok(
      Math.max(a, b) === 11 || Math.abs(a - b) === 2,
      `stopped at the first win, ${a}-${b}`,
    );
    assert.deepEqual(game.scores, [0, 0], 'reset for the next game');
  }
});

test('a point scored mid-game updates the board and hands the serve on', () => {
  const game = newTableGame();
  scorePoint(game, 1);
  scorePoint(game, 1);
  assert.deepEqual(game.scores, [0, 2]);
  assert.equal(game.server, 1);
  assert.equal(game.winner, null);
  assert.ok(game.pause > 0, 'breather before the next serve');
});
