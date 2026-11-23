/**
 * The wall CLOCK shows the real local time. The sky runs on its own hourly loop,
 * so the hands come from the device clock instead. DOM-free: the renderer draws
 * the cells this returns on top of the (hand-less) CLOCK sprite.
 */

import {
  CLOCK_HOUR_HAND_LENGTH,
  CLOCK_MINUTE_HAND_LENGTH,
  CLOCK_PIVOT_COL,
  CLOCK_PIVOT_ROW,
} from '../../constants.js';

/** A sprite pixel, relative to the top-left of the CLOCK sprite. */
export interface ClockCell {
  col: number;
  row: number;
}

export interface ClockHands {
  hour: ClockCell[];
  minute: ClockCell[];
}

let override: Date | null = null;

/** Pin the clock to a moment (null = the real time). For tests and e2e. */
export function setClockTime(date: Date | null): void {
  override = date;
}

export function currentClockTime(): Date {
  return override ?? new Date();
}

/** Cells from the pivot out along `degrees` (0 = 12 o'clock, clockwise). */
function ray(degrees: number, length: number): ClockCell[] {
  const rad = (degrees * Math.PI) / 180;
  const cells: ClockCell[] = [{ col: CLOCK_PIVOT_COL, row: CLOCK_PIVOT_ROW }];
  const seen = new Set<string>([`${CLOCK_PIVOT_COL},${CLOCK_PIVOT_ROW}`]);
  for (let r = 0.5; r <= length + 1e-9; r += 0.5) {
    const col = Math.round(CLOCK_PIVOT_COL + r * Math.sin(rad));
    const row = Math.round(CLOCK_PIVOT_ROW - r * Math.cos(rad));
    const key = `${col},${row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ col, row });
  }
  return cells;
}

/** The hands' pixels for a moment, read in the device's local time. */
export function clockHands(date: Date): ClockHands {
  const minutes = date.getMinutes() + date.getSeconds() / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  return {
    hour: ray(hours * 30, CLOCK_HOUR_HAND_LENGTH),
    minute: ray(minutes * 6, CLOCK_MINUTE_HAND_LENGTH),
  };
}
