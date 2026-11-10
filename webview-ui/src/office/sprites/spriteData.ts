import type { ColorValue } from '../../components/ui/types.js';
import {
  PALETTE_COUNT,
  PHONE_CASE_COLOR,
  PHONE_HAND_FALLBACK_COLOR,
  PHONE_OUTLINE_COLOR,
  PHONE_SCREEN_ALT_COLOR,
  PHONE_SCREEN_COLOR,
  TABLE_TENNIS_PADDLE_COLOR,
  TABLE_TENNIS_PADDLE_HANDLE_COLOR,
  TABLE_TENNIS_PADDLE_RIM_COLOR,
} from '../../constants.js';
import { adjustSprite } from '../colorize.js';
import type { Direction, SpriteData } from '../types.js';
import { Direction as Dir } from '../types.js';
import bubblePermissionData from './bubble-permission.json';
import bubblePetData from './bubble-pet.json';
import bubbleWaitingData from './bubble-waiting.json';

// ── Speech Bubble Sprites ───────────────────────────────────────

interface BubbleSpriteJson {
  palette: Record<string, string>;
  pixels: string[][];
}

function resolveBubbleSprite(data: BubbleSpriteJson): SpriteData {
  return data.pixels.map((row) => row.map((key) => data.palette[key] ?? key));
}

/** Permission bubble: white square with "..." in amber, and a tail pointer (11x13) */
export const BUBBLE_PERMISSION_SPRITE: SpriteData = resolveBubbleSprite(bubblePermissionData);

/** Waiting bubble: white square with green checkmark, and a tail pointer (11x13) */
export const BUBBLE_WAITING_SPRITE: SpriteData = resolveBubbleSprite(bubbleWaitingData);

/** Heart bubble: pet petting feedback (11x13) */
export const BUBBLE_HEART_SPRITE: SpriteData = resolveBubbleSprite(bubblePetData);

// ════════════════════════════════════════════════════════════════
// Loaded character sprites (from PNG assets)
// ════════════════════════════════════════════════════════════════

interface LoadedCharacterData {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
}

let loadedCharacters: LoadedCharacterData[] | null = null;

/** Set pre-colored character sprites loaded from PNG assets. Call this when characterSpritesLoaded message arrives. */
export function setCharacterTemplates(data: LoadedCharacterData[]): void {
  loadedCharacters = data;
  // Clear cache so sprites are rebuilt from loaded data
  spriteCache.clear();
}

/** Return the number of loaded character palettes, or PALETTE_COUNT as fallback. */
export function getLoadedCharacterCount(): number {
  return loadedCharacters ? loadedCharacters.length : PALETTE_COUNT;
}

/** Flip a SpriteData horizontally (for generating left sprites from right) */
function flipSpriteHorizontal(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse());
}

// ════════════════════════════════════════════════════════════════
// Sprite resolution + caching
// ════════════════════════════════════════════════════════════════

export interface CharacterSprites {
  walk: Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>;
  typing: Record<Direction, [SpriteData, SpriteData]>;
  reading: Record<Direction, [SpriteData, SpriteData]>;
  /** Walking while vibe coding on the phone (working agent on its way to work). */
  phoneWalk: Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>;
  /** Standing and vibe coding on the phone (no computer or pairing seat free);
   *  the two frames flicker the screen. */
  phone: Record<Direction, [SpriteData, SpriteData]>;
  /** Table tennis, standing with a paddle: [ready, swing]. Facing up/down the
   *  paddle is hidden (players only ever face left or right). */
  paddle: Record<Direction, [SpriteData, SpriteData]>;
  /** Playing at an arcade machine, standing: [hands on the controls, pressing]. */
  arcade: Record<Direction, [SpriteData, SpriteData]>;
}

type BaseSprites = Omit<CharacterSprites, 'phoneWalk' | 'phone' | 'paddle' | 'arcade'>;

/**
 * Copy a block of pixels (rows r0..r1, cols c0..c1) by (dr, dc). The vacated
 * cells take `fill` ('' = transparent); the moved pixels are drawn on top.
 */
function moveBlock(
  sprite: SpriteData,
  r0: number,
  r1: number,
  c0: number,
  c1: number,
  dr: number,
  dc: number,
  fill: string,
): SpriteData {
  const out = sprite.map((row) => [...row]);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (out[r]) out[r][c] = fill;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const px = sprite[r]?.[c];
      const tr = r + dr;
      const tc = c + dc;
      if (px && out[tr] && tc >= 0 && tc < out[tr].length) out[tr][tc] = px;
    }
  }
  return out;
}

/**
 * Standing at an arcade machine, from the standing walk frame (the typing
 * frames are drawn seated). Facing up or down both arms lift to the controls,
 * one row more on the press frame; facing right the hand reaches forward to
 * the buttons (left is the mirror).
 */
function arcadePose(stand: SpriteData, dir: 'vertical' | 'right', press: boolean): SpriteData {
  const lift = press ? -2 : -1;
  if (dir === 'vertical') {
    const left = moveBlock(stand, 21, 24, 1, 3, lift, 0, '');
    return moveBlock(left, 21, 24, 12, 14, lift, 0, '');
  }
  // The torso colour fills where the hand hung, so no hole shows in the body
  const torso = stand[20]?.[7] ?? '';
  return moveBlock(stand, 22, 24, 6, 9, lift, 3, torso);
}

/**
 * Draw a table-tennis paddle in the hand of a right-facing character (left is
 * the mirror). Ready: blade low beside the hand, over the table edge. Swing:
 * arm out and blade raised forward to meet the ball.
 */
function withPaddle(sprite: SpriteData, swing: boolean, skin: string): SpriteData {
  const out = sprite.map((row) => [...row]);
  const put = (row: number, col: number, color: string) => {
    if (out[row] && col >= 0 && col < out[row].length) out[row][col] = color;
  };
  const top = swing ? 15 : 18;
  // Blade: 3x3 rubber face with a darker rim on the outer column and bottom
  for (let r = top; r < top + 3; r++) {
    for (let c = 13; c <= 15; c++) {
      const rim = c === 15 || r === top + 2;
      put(r, c, rim ? TABLE_TENNIS_PADDLE_RIM_COLOR : TABLE_TENNIS_PADDLE_COLOR);
    }
  }
  put(top + 3, 13, TABLE_TENNIS_PADDLE_HANDLE_COLOR);
  // Hand on the handle (pushed out on the swing)
  put(top + 4, swing ? 13 : 12, skin);
  if (swing) put(top + 4, 12, skin);
  return out;
}

/** Where the hand sits on the down-facing walk sprite (sampled for skin). */
const HAND_SAMPLE = { row: 22, col: 2 } as const;

/**
 * Draw a phone held in front of the character. Facing down it is held at the
 * chest with the screen toward the viewer; facing right it is held out in
 * front of the face (left is the mirror). Facing up the body hides it.
 */
function withPhone(
  sprite: SpriteData,
  dir: 'down' | 'right',
  screen: string,
  skin: string,
): SpriteData {
  const out = sprite.map((row) => [...row]);
  const put = (row: number, col: number, color: string) => {
    if (out[row] && col >= 0 && col < out[row].length) out[row][col] = color;
  };
  // A light rim round the dark case keeps it readable against dark clothes.
  const ring = (r0: number, r1: number, c0: number, c1: number) => {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (r === r0 || r === r1 || c === c0 || c === c1) put(r, c, PHONE_OUTLINE_COLOR);
  };
  if (dir === 'down') {
    ring(19, 24, 8, 12);
    for (let r = 20; r <= 23; r++) for (let c = 9; c <= 11; c++) put(r, c, PHONE_CASE_COLOR);
    put(21, 10, screen);
    put(22, 10, screen);
    put(24, 9, skin);
    put(24, 10, skin);
  } else {
    ring(18, 23, 11, 13);
    for (let r = 19; r <= 22; r++) put(r, 12, PHONE_CASE_COLOR);
    put(19, 11, PHONE_CASE_COLOR);
    put(20, 11, screen);
    put(21, 11, screen);
    put(22, 11, skin);
  }
  return out;
}

/** Add the phone variants to a resolved sprite set. */
function addPhoneSprites(base: BaseSprites): CharacterSprites {
  const sample = base.walk[Dir.DOWN][1][HAND_SAMPLE.row]?.[HAND_SAMPLE.col];
  const skin = sample || PHONE_HAND_FALLBACK_COLOR;
  const down = (s: SpriteData, screen = PHONE_SCREEN_COLOR) => withPhone(s, 'down', screen, skin);
  const right = (s: SpriteData, screen = PHONE_SCREEN_COLOR) => withPhone(s, 'right', screen, skin);
  const walkDown = base.walk[Dir.DOWN];
  const walkUp = base.walk[Dir.UP];
  const walkRight = base.walk[Dir.RIGHT];
  const rightWalk = walkRight.map((s) => right(s)) as [
    SpriteData,
    SpriteData,
    SpriteData,
    SpriteData,
  ];
  const rightStand: [SpriteData, SpriteData] = [
    right(walkRight[1]),
    right(walkRight[1], PHONE_SCREEN_ALT_COLOR),
  ];
  const ready = withPaddle(walkRight[1], false, skin);
  const swing = withPaddle(walkRight[2], true, skin);
  const arcadeRight: [SpriteData, SpriteData] = [
    arcadePose(walkRight[1], 'right', false),
    arcadePose(walkRight[1], 'right', true),
  ];
  return {
    ...base,
    arcade: {
      [Dir.DOWN]: [
        arcadePose(walkDown[1], 'vertical', false),
        arcadePose(walkDown[1], 'vertical', true),
      ],
      [Dir.UP]: [arcadePose(walkUp[1], 'vertical', false), arcadePose(walkUp[1], 'vertical', true)],
      [Dir.RIGHT]: arcadeRight,
      [Dir.LEFT]: [flipSpriteHorizontal(arcadeRight[0]), flipSpriteHorizontal(arcadeRight[1])],
    } as Record<Direction, [SpriteData, SpriteData]>,
    paddle: {
      [Dir.DOWN]: [walkDown[1], walkDown[1]],
      [Dir.UP]: [walkUp[1], walkUp[1]],
      [Dir.RIGHT]: [ready, swing],
      [Dir.LEFT]: [flipSpriteHorizontal(ready), flipSpriteHorizontal(swing)],
    } as Record<Direction, [SpriteData, SpriteData]>,
    phoneWalk: {
      [Dir.DOWN]: walkDown.map((s) => down(s)),
      [Dir.UP]: walkUp,
      [Dir.RIGHT]: rightWalk,
      [Dir.LEFT]: rightWalk.map(flipSpriteHorizontal),
    } as Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>,
    phone: {
      [Dir.DOWN]: [down(walkDown[1]), down(walkDown[1], PHONE_SCREEN_ALT_COLOR)],
      [Dir.UP]: [walkUp[1], walkUp[1]],
      [Dir.RIGHT]: rightStand,
      [Dir.LEFT]: [flipSpriteHorizontal(rightStand[0]), flipSpriteHorizontal(rightStand[1])],
    } as Record<Direction, [SpriteData, SpriteData]>,
  };
}

const spriteCache = new Map<string, CharacterSprites>();

/** Apply hue shift to every sprite in a CharacterSprites set */
function hueShiftSprites(sprites: BaseSprites, hueShift: number): BaseSprites {
  const color: ColorValue = { h: hueShift, s: 0, b: 0, c: 0 };
  const shift = (s: SpriteData) => adjustSprite(s, color);
  const shiftWalk = (
    arr: [SpriteData, SpriteData, SpriteData, SpriteData],
  ): [SpriteData, SpriteData, SpriteData, SpriteData] => [
    shift(arr[0]),
    shift(arr[1]),
    shift(arr[2]),
    shift(arr[3]),
  ];
  const shiftPair = (arr: [SpriteData, SpriteData]): [SpriteData, SpriteData] => [
    shift(arr[0]),
    shift(arr[1]),
  ];
  return {
    walk: {
      [Dir.DOWN]: shiftWalk(sprites.walk[Dir.DOWN]),
      [Dir.UP]: shiftWalk(sprites.walk[Dir.UP]),
      [Dir.RIGHT]: shiftWalk(sprites.walk[Dir.RIGHT]),
      [Dir.LEFT]: shiftWalk(sprites.walk[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>,
    typing: {
      [Dir.DOWN]: shiftPair(sprites.typing[Dir.DOWN]),
      [Dir.UP]: shiftPair(sprites.typing[Dir.UP]),
      [Dir.RIGHT]: shiftPair(sprites.typing[Dir.RIGHT]),
      [Dir.LEFT]: shiftPair(sprites.typing[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData]>,
    reading: {
      [Dir.DOWN]: shiftPair(sprites.reading[Dir.DOWN]),
      [Dir.UP]: shiftPair(sprites.reading[Dir.UP]),
      [Dir.RIGHT]: shiftPair(sprites.reading[Dir.RIGHT]),
      [Dir.LEFT]: shiftPair(sprites.reading[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData]>,
  };
}

/** Create a transparent placeholder sprite of given dimensions */
function emptySprite(w: number, h: number): SpriteData {
  const rows: string[][] = [];
  for (let y = 0; y < h; y++) {
    rows.push(new Array(w).fill(''));
  }
  return rows;
}

export function getCharacterSprites(paletteIndex: number, hueShift = 0): CharacterSprites {
  const cacheKey = `${paletteIndex}:${hueShift}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) return cached;

  let sprites: BaseSprites;

  if (loadedCharacters) {
    // Use pre-colored character sprites directly (no palette swapping)
    const char = loadedCharacters[paletteIndex % loadedCharacters.length];
    const d = char.down;
    const u = char.up;
    const rt = char.right;
    const flip = flipSpriteHorizontal;

    sprites = {
      walk: {
        [Dir.DOWN]: [d[0], d[1], d[2], d[1]],
        [Dir.UP]: [u[0], u[1], u[2], u[1]],
        [Dir.RIGHT]: [rt[0], rt[1], rt[2], rt[1]],
        [Dir.LEFT]: [flip(rt[0]), flip(rt[1]), flip(rt[2]), flip(rt[1])],
      },
      typing: {
        [Dir.DOWN]: [d[3], d[4]],
        [Dir.UP]: [u[3], u[4]],
        [Dir.RIGHT]: [rt[3], rt[4]],
        [Dir.LEFT]: [flip(rt[3]), flip(rt[4])],
      },
      reading: {
        [Dir.DOWN]: [d[5], d[6]],
        [Dir.UP]: [u[5], u[6]],
        [Dir.RIGHT]: [rt[5], rt[6]],
        [Dir.LEFT]: [flip(rt[5]), flip(rt[6])],
      },
    };
  } else {
    // Fallback: return transparent placeholder sprites (16×32)
    const e = emptySprite(16, 32);
    const walkSet: [SpriteData, SpriteData, SpriteData, SpriteData] = [e, e, e, e];
    const pairSet: [SpriteData, SpriteData] = [e, e];
    sprites = {
      walk: {
        [Dir.DOWN]: walkSet,
        [Dir.UP]: walkSet,
        [Dir.RIGHT]: walkSet,
        [Dir.LEFT]: walkSet,
      },
      typing: {
        [Dir.DOWN]: pairSet,
        [Dir.UP]: pairSet,
        [Dir.RIGHT]: pairSet,
        [Dir.LEFT]: pairSet,
      },
      reading: {
        [Dir.DOWN]: pairSet,
        [Dir.UP]: pairSet,
        [Dir.RIGHT]: pairSet,
        [Dir.LEFT]: pairSet,
      },
    };
  }

  // Apply hue shift if non-zero
  if (hueShift !== 0) {
    sprites = hueShiftSprites(sprites, hueShift);
  }

  // Phone overlays go on after the hue shift so the phone keeps its colours
  const full = addPhoneSprites(sprites);
  spriteCache.set(cacheKey, full);
  return full;
}
