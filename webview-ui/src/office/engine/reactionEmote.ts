/**
 * Drawing for the pass/fail emotes (canvas). Kept apart from reactions.ts so the
 * state and pose logic stays DOM-free for the Node test runner.
 */

import {
  REACTION_BADGE_FADE_SEC,
  REACTION_BADGE_FAIL_COLOR,
  REACTION_BADGE_GLYPH_COLOR,
  REACTION_BADGE_PASS_COLOR,
  REACTION_BADGE_POP_SEC,
  REACTION_BADGE_RIM_COLOR,
  REACTION_CLOUD_COLOR,
  REACTION_CLOUD_DELAY_SEC,
  REACTION_CLOUD_SHADE_COLOR,
  REACTION_CONFETTI_BURSTS_SEC,
  REACTION_CONFETTI_COLORS,
  REACTION_CONFETTI_COUNT,
  REACTION_CONFETTI_GRAVITY_PX,
  REACTION_CONFETTI_LIFE_SEC,
  REACTION_CONFETTI_SPEED_PX,
  REACTION_DROP_COLOR,
  REACTION_DROP_FALL_PX,
  REACTION_DROP_PERIOD_SEC,
  REACTION_EMOTE_RISE_PX,
  REACTION_SHAKE_SEC,
} from '../../constants.js';
import type { CharacterReaction } from './reactions.js';
import { reactionDuration, reactionShakePx } from './reactions.js';

// ── Emotes ───────────────────────────────────────────────────

const CHECK_BADGE = ['.RRRRR.', 'RGGGGGR', 'RGGGWGR', 'RWGGWGR', 'RGWWWGR', 'RGGWGGR', '.RRRRR.'];
const ALERT_BADGE = ['.RRRRR.', 'RGGWGGR', 'RGGWGGR', 'RGGWGGR', 'RGGGGGR', 'RGGWGGR', '.RRRRR.'];
const CLOUD = ['..SSS....', '.SCCCSSS.', 'SCCCCCCCS', 'SCCCCCCCS', '.SSSSSSS.'];

function drawGrid(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Record<string, string>,
  left: number,
  top: number,
  unit: number,
): void {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const color = palette[rows[r][c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(left + c * unit, top + r * unit, unit, unit);
    }
  }
}

/** Deterministic 0..1 noise so each agent's confetti is stable frame to frame. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Badge pop: grows over a few steps, holds, then fades out. Returns scale 0..1 and alpha. */
function badgeEnvelope(t: number, duration: number): { scale: number; alpha: number } {
  const scale = Math.min(1, t / REACTION_BADGE_POP_SEC);
  const fadeStart = duration - REACTION_BADGE_FADE_SEC;
  const alpha = t > fadeStart ? Math.max(0, (duration - t) / REACTION_BADGE_FADE_SEC) : 1;
  return { scale, alpha };
}

/**
 * Draw the emote for a reaction. `cx` is the character's horizontal centre and
 * `headY` the top of its head, both in canvas device pixels; `unit` is one
 * sprite pixel (the zoom).
 */
export function drawReactionEmote(
  ctx: CanvasRenderingContext2D,
  r: CharacterReaction,
  seed: number,
  cx: number,
  headY: number,
  unit: number,
): void {
  const duration = reactionDuration(r.kind);
  const { scale, alpha } = badgeEnvelope(r.t, duration);
  ctx.save();
  if (r.kind === 'pass') {
    // Confetti bursts
    for (let b = 0; b < REACTION_CONFETTI_BURSTS_SEC.length; b++) {
      const age = r.t - REACTION_CONFETTI_BURSTS_SEC[b];
      if (age < 0 || age > REACTION_CONFETTI_LIFE_SEC) continue;
      for (let i = 0; i < REACTION_CONFETTI_COUNT; i++) {
        const n = seed * 101 + b * 37 + i;
        const angle = (-0.15 - noise(n) * 0.7) * Math.PI;
        const dir = i % 2 === 0 ? 1 : -1;
        const speed = REACTION_CONFETTI_SPEED_PX * (0.5 + noise(n + 2) * 0.6);
        const x = dir * Math.cos(angle) * speed * age;
        const y = Math.sin(angle) * speed * age + 0.5 * REACTION_CONFETTI_GRAVITY_PX * age * age;
        ctx.globalAlpha = Math.min(1, (REACTION_CONFETTI_LIFE_SEC - age) / 0.3);
        ctx.fillStyle = REACTION_CONFETTI_COLORS[(i + b) % REACTION_CONFETTI_COLORS.length];
        const tumble = Math.floor((age + noise(n + 3)) / 0.1) % 2 === 0;
        ctx.fillRect(
          Math.round(cx + x * unit),
          Math.round(headY + (y - 2) * unit),
          (tumble ? 2 : 1) * unit,
          (tumble ? 1 : 2) * unit,
        );
      }
    }
    // Check badge pops above the head
    if (scale > 0) {
      const size = Math.max(1, Math.round(scale * 7));
      const px = Math.max(1, Math.round(unit * (size / 7)));
      ctx.globalAlpha = alpha;
      const pad = Math.round((7 * unit - 7 * px) / 2);
      drawGrid(
        ctx,
        CHECK_BADGE,
        {
          R: REACTION_BADGE_RIM_COLOR,
          G: REACTION_BADGE_PASS_COLOR,
          W: REACTION_BADGE_GLYPH_COLOR,
        },
        Math.round(cx - 3.5 * unit + pad),
        Math.round(headY - (7 + REACTION_EMOTE_RISE_PX) * unit + pad),
        px,
      );
    }
  } else {
    // Rain cloud over the head, drops falling in a loop
    if (r.t >= REACTION_CLOUD_DELAY_SEC) {
      ctx.globalAlpha = alpha;
      const cloudTop = Math.round(headY - (5 + REACTION_EMOTE_RISE_PX) * unit);
      const cloudLeft = Math.round(cx - 4.5 * unit);
      drawGrid(
        ctx,
        CLOUD,
        { S: REACTION_CLOUD_SHADE_COLOR, C: REACTION_CLOUD_COLOR },
        cloudLeft,
        cloudTop,
        unit,
      );
      ctx.fillStyle = REACTION_DROP_COLOR;
      for (let i = 0; i < 3; i++) {
        const phase = (r.t / REACTION_DROP_PERIOD_SEC + i / 3) % 1;
        ctx.globalAlpha = alpha * (1 - phase * 0.6);
        ctx.fillRect(
          cloudLeft + (2 + i * 2) * unit,
          cloudTop + (5 + phase * REACTION_DROP_FALL_PX) * unit,
          unit,
          2 * unit,
        );
      }
    }
    // Red "!" badge beside the cloud, shaking as it lands
    if (scale > 0) {
      const wobble = r.t < REACTION_SHAKE_SEC ? reactionShakePx(r) : 0;
      ctx.globalAlpha = alpha;
      drawGrid(
        ctx,
        ALERT_BADGE,
        {
          R: REACTION_BADGE_RIM_COLOR,
          G: REACTION_BADGE_FAIL_COLOR,
          W: REACTION_BADGE_GLYPH_COLOR,
        },
        Math.round(cx + (5 + wobble) * unit),
        Math.round(headY - (9 + REACTION_EMOTE_RISE_PX) * unit),
        Math.max(1, Math.round(unit * scale)),
      );
    }
  }
  ctx.restore();
}
