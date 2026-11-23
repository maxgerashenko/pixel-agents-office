/**
 * Monitor glow: a PC screen tints by what the agent at it is doing.
 * Editing → blue, shell → black, reading → green (the stock screen).
 * Pure and DOM-free; the tinted sprite is cached per source sprite + kind.
 */

import {
  MONITOR_EDIT_TOOLS,
  MONITOR_GLOW_PALETTES,
  MONITOR_SCREEN_TYPE_PREFIX,
  MONITOR_SHELL_TOOLS,
} from '../constants.js';
import { isReadingToolName } from './toolUtils.js';
import type { SpriteData } from './types.js';

export type MonitorGlow = 'edit' | 'shell' | 'read';

/** What an agent's current tool does to its monitor, or null for no tint. */
export function monitorGlowForTool(tool: string | null | undefined): MonitorGlow | null {
  if (!tool) return null;
  if (MONITOR_SHELL_TOOLS.has(tool)) return 'shell';
  if (MONITOR_EDIT_TOOLS.has(tool)) return 'edit';
  if (isReadingToolName(tool)) return 'read';
  return null;
}

/** Only the lit front-facing PC has a screen to tint. */
export function hasTintableScreen(type: string): boolean {
  return type.startsWith(MONITOR_SCREEN_TYPE_PREFIX);
}

const cache = new WeakMap<SpriteData, Map<MonitorGlow, SpriteData>>();

/** Recolor the stock green screen pixels; every other pixel is untouched. */
export function tintScreen(sprite: SpriteData, glow: MonitorGlow): SpriteData {
  const palette = MONITOR_GLOW_PALETTES[glow];
  if (!palette || Object.keys(palette).length === 0) return sprite;
  let byKind = cache.get(sprite);
  const hit = byKind?.get(glow);
  if (hit) return hit;
  const tinted = sprite.map((row) => row.map((px) => palette[px.toLowerCase()] ?? px));
  if (!byKind) cache.set(sprite, (byKind = new Map()));
  byKind.set(glow, tinted);
  return tinted;
}
