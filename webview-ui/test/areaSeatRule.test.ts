/**
 * Seat rule for Directory-mapped Areas (issue #3), tested on the OfficeState
 * domain model like greeter/teammateSeating:
 *   - an agent whose Directory is mapped to Areas sits ONLY inside them (no seat
 *     rather than a fallback seat when they are full);
 *   - an unmapped agent (or one whose mapped labels are painted nowhere) sits
 *     ONLY outside every Area;
 *   - setAreaMappings re-seats a misplaced agent and leaves a correct one alone.
 *
 * Seats are injected directly so no furniture catalog is needed.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { OfficeState } from '../src/office/engine/officeState.js';
import type { OfficeLayout, Seat } from '../src/office/types.js';
import { CharacterState, Direction, TileType } from '../src/office/types.js';

const COLS = 10;
const ROWS = 4;
const IN_SEATS = ['in1', 'in2']; // cols 1,2 → inside "Eng" (cols 0-4)
const OUT_SEATS = ['out1', 'out2']; // cols 7,8 → outside every Area

function makeOffice(opts: { paintArea?: boolean } = {}): OfficeState {
  const paint = opts.paintArea ?? true;
  const layout: OfficeLayout = {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: new Array<TileType>(COLS * ROWS).fill(TileType.FLOOR_1),
    furniture: [],
    areas: [{ label: 'Eng' } as never],
    areaTiles: Array.from({ length: COLS * ROWS }, (_, i) =>
      paint && i % COLS < 5 ? 'Eng' : null,
    ),
  };
  const os = new OfficeState(layout);
  const seat = (uid: string, col: number): [string, Seat] => [
    uid,
    { uid, seatCol: col, seatRow: 1, facingDir: Direction.DOWN, assigned: false },
  ];
  os.seats = new Map([seat('in1', 1), seat('in2', 2), seat('out1', 7), seat('out2', 8)]);
  // Injected seats face no furniture: mark them all as work seats
  (os as unknown as { workSeatIds: Set<string> }).workSeatIds = new Set(os.seats.keys());
  return os;
}

test('mapped agent only gets in-area seats, and none once the area is full', () => {
  const os = makeOffice();
  os.areaMappings = { alpha: ['Eng'] };
  os.addAgent(1, 0, 0, undefined, true, 'alpha');
  os.addAgent(2, 0, 0, undefined, true, 'alpha');
  assert.ok(IN_SEATS.includes(os.characters.get(1)!.seatId!));
  assert.ok(IN_SEATS.includes(os.characters.get(2)!.seatId!));

  os.addAgent(3, 0, 0, undefined, true, 'alpha');
  const third = os.characters.get(3)!;
  assert.equal(third.seatId, null, 'no fallback to unzoned seats');
  assert.ok(!OUT_SEATS.some((u) => os.seats.get(u)!.assigned));
  assert.ok(third.tileCol < 5, 'seatless mapped agent stands inside its Area');
});

test('unmapped agent never gets an in-area seat', () => {
  const os = makeOffice();
  os.areaMappings = { alpha: ['Eng'] };
  os.addAgent(1, 0, 0, undefined, true, 'beta');
  os.addAgent(2, 0, 0, undefined, true);
  os.addAgent(3, 0, 0, undefined, true, 'beta');
  assert.ok(OUT_SEATS.includes(os.characters.get(1)!.seatId!));
  assert.ok(OUT_SEATS.includes(os.characters.get(2)!.seatId!));
  assert.equal(os.characters.get(3)!.seatId, null, 'no fallback into Areas');
  assert.ok(!IN_SEATS.some((u) => os.seats.get(u)!.assigned));
});

test('a mapped label painted nowhere behaves as unmapped', () => {
  const os = makeOffice({ paintArea: false });
  os.areaMappings = { alpha: ['Eng'] };
  // No tile carries the label, so every seat is "outside every Area".
  os.addAgent(1, 0, 0, undefined, true, 'alpha');
  assert.ok(os.characters.get(1)!.seatId);

  const os2 = makeOffice();
  os2.areaMappings = { alpha: ['Ghost'] };
  os2.addAgent(1, 0, 0, undefined, true, 'alpha');
  assert.ok(OUT_SEATS.includes(os2.characters.get(1)!.seatId!));
});

test('a preferred (restored) seat that breaks the rule is not honoured', () => {
  const os = makeOffice();
  os.areaMappings = { alpha: ['Eng'] };
  os.addAgent(1, 0, 0, 'out1', true, 'alpha');
  assert.ok(IN_SEATS.includes(os.characters.get(1)!.seatId!));
});

test('setAreaMappings re-seats a misplaced agent and leaves a correct one alone', () => {
  const os = makeOffice();
  // Mappings not loaded yet: both agents are treated as unmapped.
  os.addAgent(1, 0, 0, undefined, true, 'alpha'); // will become mapped
  os.addAgent(2, 0, 0, undefined, true, 'beta'); // stays unmapped
  const betaBefore = os.characters.get(2)!;
  const betaSeat = betaBefore.seatId;
  const betaPos = { x: betaBefore.x, y: betaBefore.y };
  assert.ok(OUT_SEATS.includes(os.characters.get(1)!.seatId!));

  os.setAreaMappings({ alpha: ['Eng'] });

  const alpha = os.characters.get(1)!;
  assert.ok(IN_SEATS.includes(alpha.seatId!), 'alpha moved into its Area');
  assert.equal(alpha.state, CharacterState.WALK, 'alpha pathfinds to the new seat');
  assert.ok(alpha.path.length > 0);
  assert.equal(
    [...os.seats.values()].filter((s) => s.assigned).length,
    2,
    'old seat released, no double booking',
  );
  const beta = os.characters.get(2)!;
  assert.equal(beta.seatId, betaSeat);
  assert.deepEqual({ x: beta.x, y: beta.y }, betaPos, 'correctly placed agent did not move');
});

test('setAreaMappings leaves an agent seatless when its Area has no free seat', () => {
  const os = makeOffice();
  os.addAgent(1, 0, 0, undefined, true, 'alpha');
  os.addAgent(2, 0, 0, undefined, true, 'alpha');
  os.addAgent(3, 0, 0, undefined, true, 'gamma'); // takes in-area? no: unmapped → outside
  os.setAreaMappings({ alpha: ['Eng'], gamma: ['Eng'] });
  const seated = [1, 2, 3].filter((id) => os.characters.get(id)!.seatId !== null);
  assert.equal(seated.length, 2, 'only two in-area seats exist');
  for (const id of seated) assert.ok(IN_SEATS.includes(os.characters.get(id)!.seatId!));
});
