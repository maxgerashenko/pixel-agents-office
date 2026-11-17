/**
 * Pass / fail reactions: a short body animation plus an emote on the character
 * when a command it ran passes (a test, build or lint run) or fails.
 *
 * - pass: both arms thrown up and swinging, a hop on every beat, a green check
 *   badge and bursts of confetti.
 * - fail: the head sinks onto the shoulders, a shake, a red "!" badge under a
 *   small rain cloud.
 *
 * Pure of the DOM: state + sprite derivation + draw helpers that take a 2D
 * context. The reaction is transient (never persisted).
 */

import {
  PHONE_HAND_FALLBACK_COLOR,
  REACTION_ARM_PAD_PX,
  REACTION_ARM_STEPS,
  REACTION_CHEER_BODY_SEC,
  REACTION_FAIL_DURATION_SEC,
  REACTION_HEAD_ROWS,
  REACTION_HOP_HEIGHT_PX,
  REACTION_HOP_PERIOD_SEC,
  REACTION_OUTLINE_FALLBACK_COLOR,
  REACTION_PASS_DURATION_SEC,
  REACTION_SHAKE_PERIOD_SEC,
  REACTION_SHAKE_SEC,
  REACTION_SHOULDER_BELOW_HEAD_PX,
  REACTION_SLUMP_HEAD_DROP_PX,
} from '../../constants.js';
import type { CharacterSprites } from '../sprites/spriteData.js';
import type { SpriteData } from '../types.js';
import { Direction } from '../types.js';

export type ReactionKind = 'pass' | 'fail';

/** A reaction in progress: seconds since it started. */
export interface CharacterReaction {
  kind: ReactionKind;
  t: number;
}

export function reactionDuration(kind: ReactionKind): number {
  return kind === 'pass' ? REACTION_PASS_DURATION_SEC : REACTION_FAIL_DURATION_SEC;
}

/** Start (or restart) a reaction on anything that carries one. */
export function startReaction(ch: { reaction?: CharacterReaction }, kind: ReactionKind): void {
  ch.reaction = { kind, t: 0 };
}

/** Advance the clock; clears the reaction when it has played out. */
export function advanceReaction(ch: { reaction?: CharacterReaction }, dt: number): void {
  const r = ch.reaction;
  if (!r) return;
  r.t += dt;
  if (r.t >= reactionDuration(r.kind)) ch.reaction = undefined;
}

/** Upward hop (sprite pixels) of a cheering character at time t. */
export function reactionHopPx(r: CharacterReaction | undefined): number {
  if (!r || r.kind !== 'pass' || r.t >= REACTION_CHEER_BODY_SEC) return 0;
  const phase = (r.t % REACTION_HOP_PERIOD_SEC) / REACTION_HOP_PERIOD_SEC;
  return Math.round(Math.sin(phase * Math.PI) * REACTION_HOP_HEIGHT_PX);
}

/** Sideways shake (sprite pixels) of a failing character at time t. */
export function reactionShakePx(r: CharacterReaction | undefined): number {
  if (!r || r.kind !== 'fail' || r.t >= REACTION_SHAKE_SEC) return 0;
  return Math.floor(r.t / REACTION_SHAKE_PERIOD_SEC) % 2 === 0 ? 1 : -1;
}

/** Which body pose is on show: arm frame 0/1 while cheering, 'slump' while
 *  failing, null when the character keeps its normal pose. */
export function reactionBodyPose(r: CharacterReaction | undefined): 0 | 1 | 'slump' | null {
  if (!r) return null;
  if (r.kind === 'fail') return 'slump';
  if (r.t >= REACTION_CHEER_BODY_SEC) return null;
  return Math.floor(r.t / REACTION_HOP_PERIOD_SEC) % 2 === 0 ? 0 : 1;
}

// ── Body sprites ─────────────────────────────────────────────

interface BodyColors {
  skin: string;
  sleeve: string;
  outline: string;
}

/** Skin, sleeve and outline colours, sampled off the character's standing frame. */
function sampleColors(sprites: CharacterSprites): BodyColors {
  const stand = sprites.walk[Direction.DOWN][1];
  const skin = stand[22]?.[2] || PHONE_HAND_FALLBACK_COLOR;
  return {
    skin,
    sleeve: stand[19]?.[4] || skin,
    outline: stand[3]?.[5] || REACTION_OUTLINE_FALLBACK_COLOR,
  };
}

/** First row of a sprite that has any pixel (the top of the head). */
export function headTopRowOf(sprite: SpriteData): number {
  for (let r = 0; r < sprite.length; r++) if (sprite[r].some((px) => px)) return r;
  return 0;
}

/** Both arms thrown up in a V (frame 0) or a steeper Y (frame 1), on a sprite
 *  padded either side so the arms clear the head. */
export function withRaisedArms(sprite: SpriteData, frame: 0 | 1, colors: BodyColors): SpriteData {
  const pad = REACTION_ARM_PAD_PX;
  const width = (sprite[0]?.length ?? 0) + pad * 2;
  const out: SpriteData = sprite.map((row) => [
    ...Array(pad).fill(''),
    ...row,
    ...Array(pad).fill(''),
  ]);
  const base = headTopRowOf(sprite) + REACTION_SHOULDER_BELOW_HEAD_PX;
  const rootCol = 3;
  const cells: Array<{ r: number; c: number; color: string }> = [];
  for (let i = 0; i < REACTION_ARM_STEPS; i++) {
    const lean = frame === 0 ? i : Math.ceil(i * 0.55);
    const r = base - i;
    const color = i >= REACTION_ARM_STEPS - 2 ? colors.skin : colors.sleeve;
    // Left arm, then its mirror image on the right
    for (const c of [rootCol - lean, rootCol - lean + 1]) {
      cells.push({ r, c: c + pad, color });
      cells.push({ r, c: width - 1 - (c + pad), color });
    }
  }
  const empty = (r: number, c: number) => out[r] !== undefined && c >= 0 && c < width && !out[r][c];
  // Outline first (never over existing pixels), then the arm itself on top
  for (const { r, c } of cells) {
    for (const [dr, dc] of [
      [0, -1],
      [0, 1],
      [-1, 0],
    ]) {
      if (empty(r + dr, c + dc)) out[r + dr][c + dc] = colors.outline;
    }
  }
  for (const { r, c, color } of cells) if (out[r] && c >= 0 && c < width) out[r][c] = color;
  return out;
}

/** Head sunk over the shoulders. */
export function withSlump(sprite: SpriteData): SpriteData {
  const out = sprite.map((row) => [...row]);
  const top = headTopRowOf(sprite);
  const bottom = top + REACTION_HEAD_ROWS - 1;
  for (let r = top; r <= bottom; r++) for (let c = 0; c < out[r].length; c++) out[r][c] = '';
  for (let r = top; r <= bottom; r++) {
    for (let c = 0; c < sprite[r].length; c++) {
      const px = sprite[r][c];
      const tr = r + REACTION_SLUMP_HEAD_DROP_PX;
      if (px && out[tr]) out[tr][c] = px;
    }
  }
  return out;
}

const poseCache = new WeakMap<SpriteData, Map<string, SpriteData>>();

/** The reaction pose for a base frame (memoised on the frame itself, so the
 *  sprite-to-canvas cache downstream keeps hitting). */
export function reactionSprite(
  base: SpriteData,
  pose: 0 | 1 | 'slump',
  sprites: CharacterSprites,
): SpriteData {
  let byPose = poseCache.get(base);
  if (!byPose) poseCache.set(base, (byPose = new Map()));
  const key = String(pose);
  let sprite = byPose.get(key);
  if (!sprite) {
    sprite = pose === 'slump' ? withSlump(base) : withRaisedArms(base, pose, sampleColors(sprites));
    byPose.set(key, sprite);
  }
  return sprite;
}
