import {
  SYNC_BALLOON_CROSS_SEC,
  SYNC_BASKET_COLOR,
  SYNC_BODY_COLOR,
  SYNC_DARK_ALPHA,
  SYNC_ENVELOPE_COLORS,
  SYNC_FLAME_OUTER_COLOR,
  SYNC_FLASH_MS,
  SYNC_ISS_CROSS_SEC,
  SYNC_LAMP_COLOR,
  SYNC_LAMP_FLASH_COLOR,
  SYNC_PANEL_COLOR,
  SYNC_STALE_ALPHA,
} from '../../constants.js';

export type SyncLiveness = 'live' | 'stale' | 'off';

export interface SyncState {
  liveness: SyncLiveness;
  /** ms epoch of the Mac's last tick, 0 when unknown. */
  lastTickAt: number;
}

let state: SyncState = { liveness: 'off', lastTickAt: 0 };

export function setSyncState(next: SyncState): void {
  state = next;
}

/** Pure: lamp colour now, or null when the craft is dark. One flash per tick, steady glow while live. */
export function syncLampColor(s: SyncState, nowMs: number): string | null {
  if (s.liveness === 'off') return null;
  if (s.liveness === 'stale') return null;
  const sinceTick = nowMs - s.lastTickAt;
  return sinceTick >= 0 && sinceTick < SYNC_FLASH_MS ? SYNC_LAMP_FLASH_COLOR : SYNC_LAMP_COLOR;
}

export function syncAlpha(s: SyncState): number {
  return s.liveness === 'live' ? 1 : s.liveness === 'stale' ? SYNC_STALE_ALPHA : SYNC_DARK_ALPHA;
}

/** The ISS crosses high, the balloon drifts lower and slower. Both lamps follow the tick. */
export function drawSyncCraft(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  px: number,
  nowSec: number,
): void {
  const lamp = syncLampColor(state, Date.now());
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = syncAlpha(state);

  // ISS: body, two solar panel pairs, lamp on the hull
  const issX =
    Math.round((((nowSec / SYNC_ISS_CROSS_SEC) % 1) * (w + 40 * px) - 30 * px) / px) * px;
  const issY = Math.round((horizonY * 0.12) / px) * px;
  ctx.fillStyle = SYNC_PANEL_COLOR;
  ctx.fillRect(issX, issY, 3 * px, 2 * px);
  ctx.fillRect(issX + 9 * px, issY, 3 * px, 2 * px);
  ctx.fillRect(issX, issY + 4 * px, 3 * px, 2 * px);
  ctx.fillRect(issX + 9 * px, issY + 4 * px, 3 * px, 2 * px);
  ctx.fillStyle = SYNC_BODY_COLOR;
  ctx.fillRect(issX + 3 * px, issY + 2 * px, 6 * px, 2 * px);
  ctx.fillRect(issX + 5 * px, issY, 2 * px, 6 * px);
  if (lamp) {
    ctx.fillStyle = lamp;
    ctx.fillRect(issX + 5 * px, issY + 2 * px, 2 * px, 2 * px);
  }

  // Balloon: striped envelope, basket below, lamp as the burner flame (drawn at twice the pixel size)
  const bp = px * 2;
  const bx =
    Math.round((((nowSec / SYNC_BALLOON_CROSS_SEC + 0.4) % 1) * (w + 40 * px) - 30 * px) / bp) * bp;
  const by = Math.round((horizonY * 0.4 + Math.sin(nowSec * 0.6) * 3 * px) / bp) * bp;
  SYNC_ENVELOPE_COLORS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(bx + (1 + i * 2) * bp, by, 2 * bp, 6 * bp);
  });
  ctx.fillRect(bx, by + bp, bp, 4 * bp);
  ctx.fillRect(bx + 7 * bp, by + bp, bp, 4 * bp);
  ctx.fillStyle = SYNC_BASKET_COLOR;
  ctx.fillRect(bx + 3 * bp, by + 8 * bp, 2 * bp, 2 * bp);
  ctx.fillRect(bx + 2 * bp, by + 6 * bp, bp, 2 * bp);
  ctx.fillRect(bx + 5 * bp, by + 6 * bp, bp, 2 * bp);
  if (lamp) {
    // Burner flame: a flickering orange tongue with a bright core, white-hot on a tick.
    const flashing = lamp === SYNC_LAMP_FLASH_COLOR;
    const tall = flashing ? 3 : 2 + (Math.floor(nowSec * 8) % 2);
    ctx.fillStyle = SYNC_FLAME_OUTER_COLOR;
    ctx.fillRect(bx + 3 * bp, by + (8 - tall) * bp, 2 * bp, tall * bp);
    ctx.fillStyle = lamp;
    ctx.fillRect(bx + 3 * bp, by + (9 - tall) * bp, 2 * bp, (tall - 1) * bp);
  }
  ctx.globalAlpha = prevAlpha;
}
