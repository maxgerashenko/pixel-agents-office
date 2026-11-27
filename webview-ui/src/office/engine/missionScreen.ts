/**
 * The mission screen: a MISSION_SCREEN item on the wall shows how many issues the GitHub board
 * (engine/issueBoard, the same data the sky and the whiteboard read) holds in each of the five
 * statuses that are active work, as five big coloured two-digit counts with the status name
 * under each. A tap on it opens the board, like the whiteboard. Pure and DOM-free; the canvas
 * draws the counts over the sprite.
 */
import type { IssueBoardStatus } from '../../../../core/src/messages.js';
import {
  MISSION_SCREEN_COUNT_MAX,
  MISSION_SCREEN_DIGIT_H,
  MISSION_SCREEN_DIGIT_SEGMENTS,
  MISSION_SCREEN_DIGIT_STROKE,
  MISSION_SCREEN_DIGIT_W,
  MISSION_SCREEN_FURNITURE_TYPE,
} from '../../constants.js';
import type { OfficeLayout } from '../types.js';
import { TILE_SIZE } from '../types.js';
import type { IssueBoardCardView } from './issueBoard.js';

/** The screen's columns, left to right: a board status and the word shown under its count. */
export const MISSION_SCREEN_COLUMNS: ReadonlyArray<{ status: IssueBoardStatus; label: string }> = [
  { status: 'needs_design', label: 'DESIGN' },
  { status: 'ready', label: 'READY' },
  { status: 'in_progress', label: 'PROGRESS' },
  { status: 'in_review', label: 'REVIEW' },
  { status: 'needs_decision', label: 'DECISION' },
];

/** Issues per column, in column order. */
export function missionCounts(cards: IssueBoardCardView[]): number[] {
  return MISSION_SCREEN_COLUMNS.map(
    ({ status }) => cards.filter((c) => c.status === status).length,
  );
}

/** A count as the screen shows it: two digits, zero-padded, capped at 99. */
export function missionDigits(count: number): string {
  const shown = Math.max(0, Math.min(MISSION_SCREEN_COUNT_MAX, Math.floor(count)));
  return String(shown).padStart(2, '0');
}

/** A screen to draw on: its sprite's top-left corner in world pixels, and the counts. */
export interface MissionScreenPlate {
  x: number;
  y: number;
  counts: number[];
}

/** One plate per mission screen in the layout, each carrying the same counts. */
export function missionScreens(layout: OfficeLayout, counts: number[]): MissionScreenPlate[] {
  const plates: MissionScreenPlate[] = [];
  for (const f of layout.furniture) {
    if (f.type !== MISSION_SCREEN_FURNITURE_TYPE) continue;
    plates.push({ x: f.col * TILE_SIZE, y: f.row * TILE_SIZE, counts });
  }
  return plates;
}

/** True when the furniture a tap landed on is a mission screen. */
export function isMissionScreen(type: string | undefined): boolean {
  return type === MISSION_SCREEN_FURNITURE_TYPE;
}

/** [x, y, w, h] of each seven-segment bar, a to g, inside a digit's box. */
const SEGMENT_RECTS: ReadonlyArray<readonly [number, number, number, number]> = (() => {
  const w = MISSION_SCREEN_DIGIT_W;
  const h = MISSION_SCREEN_DIGIT_H;
  const t = MISSION_SCREEN_DIGIT_STROKE;
  const mid = (h - t) / 2;
  const half = mid + t;
  return [
    [0, 0, w, t], // a: top
    [w - t, 0, t, half], // b: upper right
    [w - t, mid, t, half], // c: lower right
    [0, h - t, w, t], // d: bottom
    [0, mid, t, half], // e: lower left
    [0, 0, t, half], // f: upper left
    [0, mid, w, t], // g: middle
  ];
})();

/** The lit bars of one digit as rectangles in sprite pixels, relative to the digit's top-left. */
export function digitRects(digit: string): Array<readonly [number, number, number, number]> {
  const lit = MISSION_SCREEN_DIGIT_SEGMENTS[digit] ?? '';
  return SEGMENT_RECTS.filter((_, i) => lit.includes('abcdefg'[i]));
}
