/**
 * Pass / fail reactions: the clock, the hop and shake, the body poses, and the
 * OfficeState hook that starts one.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  REACTION_CHEER_BODY_SEC,
  REACTION_FAIL_DURATION_SEC,
  REACTION_PASS_DURATION_SEC,
} from '../src/constants.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import {
  advanceReaction,
  type CharacterReaction,
  reactionBodyPose,
  reactionHopPx,
  reactionShakePx,
  startReaction,
  withRaisedArms,
  withSlump,
} from '../src/office/engine/reactions.js';
import type { SpriteData } from '../src/office/types.js';

const colors = { skin: 'S', sleeve: 'O', outline: '#' };

/** A 16x32 sprite with a head block from row 3 and a torso below. */
function dummySprite(): SpriteData {
  const rows: SpriteData = Array.from({ length: 32 }, () => Array<string>(16).fill(''));
  for (let r = 3; r < 13; r++) for (let c = 1; c < 15; c++) rows[r][c] = 'h';
  for (let r = 13; r < 24; r++) for (let c = 4; c < 12; c++) rows[r][c] = 't';
  return rows;
}

test('a reaction plays out and clears itself', () => {
  const ch: { reaction?: CharacterReaction } = {};
  startReaction(ch, 'pass');
  advanceReaction(ch, REACTION_PASS_DURATION_SEC - 0.1);
  assert.ok(ch.reaction);
  advanceReaction(ch, 0.2);
  assert.equal(ch.reaction, undefined);

  startReaction(ch, 'fail');
  advanceReaction(ch, REACTION_FAIL_DURATION_SEC - 0.1);
  assert.ok(ch.reaction);
  advanceReaction(ch, 0.2);
  assert.equal(ch.reaction, undefined);
});

test('a cheer hops and swaps arm frames; after the body part it settles', () => {
  const at = (t: number): CharacterReaction => ({ kind: 'pass', t });
  assert.equal(reactionHopPx(at(0)), 0);
  assert.ok(reactionHopPx(at(0.15)) > 0);
  assert.notEqual(reactionBodyPose(at(0.05)), reactionBodyPose(at(0.35)));
  assert.equal(reactionBodyPose(at(REACTION_CHEER_BODY_SEC + 0.1)), null);
  assert.equal(reactionHopPx(at(REACTION_CHEER_BODY_SEC + 0.1)), 0);
  assert.equal(reactionHopPx(undefined), 0);
});

test('a failure slumps for its whole length and shakes only at the start', () => {
  const at = (t: number): CharacterReaction => ({ kind: 'fail', t });
  assert.equal(reactionBodyPose(at(0)), 'slump');
  assert.equal(reactionBodyPose(at(REACTION_FAIL_DURATION_SEC - 0.1)), 'slump');
  assert.notEqual(reactionShakePx(at(0.01)), 0);
  assert.notEqual(reactionShakePx(at(0.01)), reactionShakePx(at(0.1)));
  assert.equal(reactionShakePx(at(1.5)), 0);
  assert.equal(reactionHopPx(at(0.15)), 0);
});

test('raised arms widen the sprite symmetrically and rise above the shoulders', () => {
  const base = dummySprite();
  for (const frame of [0, 1] as const) {
    const arms = withRaisedArms(base, frame, colors);
    assert.ok(arms[0].length > base[0].length);
    assert.equal(arms.length, base.length);
    const w = arms[0].length;
    let armPixels = 0;
    for (let r = 0; r < arms.length; r++) {
      for (let c = 0; c < w; c++) {
        const left = arms[r][c];
        const right = arms[r][w - 1 - c];
        assert.equal(left === 'S' || left === 'O', right === 'S' || right === 'O');
        if (left === 'O' || left === 'S') armPixels++;
      }
    }
    assert.ok(armPixels > 10);
    // Hands (skin) are the highest arm pixels, level with the head
    const handRows = arms.flatMap((row, r) => (row.includes('S') ? [r] : []));
    assert.ok(Math.min(...handRows) >= 3 && Math.min(...handRows) < 13);
  }
});

test('a slump moves the head down over the shoulders and keeps every pixel', () => {
  const base = dummySprite();
  const slumped = withSlump(base);
  assert.equal(
    slumped[3].every((px) => !px),
    true,
    'top row vacated',
  );
  assert.equal(slumped[5][1], 'h', 'head now two rows lower');
  assert.equal(slumped.length, base.length);
  assert.equal(slumped[0].length, base[0].length);
});

test('triggerReaction starts one on an agent and ignores unknown ids', () => {
  const os = new OfficeState();
  os.addAgent(1, undefined, undefined, undefined, true);
  os.triggerReaction(1, 'fail');
  assert.equal(os.characters.get(1)?.reaction?.kind, 'fail');
  os.triggerReaction(99, 'pass');
  assert.equal(os.characters.get(99), undefined);
});
