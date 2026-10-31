/**
 * World coordinates → screen coordinates, in one place.
 *
 * The office is drawn by centering the map in the canvas and then applying the
 * pan, both snapped to whole device pixels so sprites stay on the pixel grid.
 * That formula was reproduced in the renderer and in each DOM overlay that
 * floats something above a character; a copy that rounds differently puts the
 * overlay a pixel off the sprite it is labelling, which is invisible in review
 * and obvious on screen.
 *
 * Deliberately free of DOM access — `dpr` is passed in, not read from
 * `window`. Reading the environment belongs at the component boundary; a state
 * or math module that reaches for `window` drags the DOM into every module
 * graph that imports it.
 */

import { TILE_SIZE, TileType } from './types.js';

/** Device-pixel offset of the map's top-left corner inside the canvas.
 *  This is the renderer's own frame of reference — overlays go through
 *  {@link overlayProjection} instead of calling this directly. */
export function mapOffset(
  canvasWidth: number,
  canvasHeight: number,
  cols: number,
  rows: number,
  zoom: number,
  panX: number,
  panY: number,
): { offsetX: number; offsetY: number } {
  const mapW = cols * TILE_SIZE * zoom;
  const mapH = rows * TILE_SIZE * zoom;
  return {
    offsetX: Math.floor((canvasWidth - mapW) / 2) + Math.round(panX),
    offsetY: Math.floor((canvasHeight - mapH) / 2) + Math.round(panY),
  };
}

/** Projects world points into CSS pixels within the overlay container that
 *  sits on top of the canvas. */
export interface OverlayProjection {
  toScreenX(worldX: number): number;
  toScreenY(worldY: number): number;
  /** Container size in world units — what the viewport currently covers.
   *  Used to cap overlay offsets against the visible area. */
  readonly viewportWorldWidth: number;
  readonly viewportWorldHeight: number;
  /** CSS px → world units, for sizing overlay geometry in world terms. */
  toWorldLength(cssPx: number): number;
}

export function overlayProjection(
  layout: { cols: number; rows: number },
  containerRect: { width: number; height: number },
  zoom: number,
  pan: { x: number; y: number },
  dpr: number,
): OverlayProjection {
  const canvasW = Math.round(containerRect.width * dpr);
  const canvasH = Math.round(containerRect.height * dpr);
  const { offsetX, offsetY } = mapOffset(
    canvasW,
    canvasH,
    layout.cols,
    layout.rows,
    zoom,
    pan.x,
    pan.y,
  );
  return {
    toScreenX: (worldX) => (offsetX + worldX * zoom) / dpr,
    toScreenY: (worldY) => (offsetY + worldY * zoom) / dpr,
    viewportWorldWidth: canvasW / zoom,
    viewportWorldHeight: canvasH / zoom,
    toWorldLength: (cssPx) => (cssPx * dpr) / zoom,
  };
}

/** World-pixel box around everything the office draws: the non-VOID tiles,
 *  plus one tile above when the top row holds walls (wall sprites rise a tile
 *  above their own). The grid itself can carry VOID margins, so its centre
 *  is not the centre of what the user sees. `null` when every tile is VOID. */
export function layoutContentBounds(layout: {
  cols: number;
  rows: number;
  tiles: readonly number[];
}): { x: number; y: number; w: number; h: number } | null {
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      if (layout.tiles[r * layout.cols + c] === TileType.VOID) continue;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
    }
  }
  if (minCol === Infinity) return null;
  let topWall = false;
  for (let c = minCol; c <= maxCol; c++) {
    if (layout.tiles[minRow * layout.cols + c] === TileType.WALL) topWall = true;
  }
  const top = (minRow - (topWall ? 1 : 0)) * TILE_SIZE;
  return {
    x: minCol * TILE_SIZE,
    y: top,
    w: (maxCol - minCol + 1) * TILE_SIZE,
    h: (maxRow + 1) * TILE_SIZE - top,
  };
}

/** The view the fit-to-width button sets: the largest whole zoom at which the
 *  office's drawn width fits the canvas, panned so the middle of the office
 *  sits in the middle of the canvas. Zoom stays an integer so sprites stay
 *  pixel-perfect, so "fit" rounds down — as wide as the grid allows without
 *  cropping. Clamped to [minZoom, maxZoom].
 *
 *  `centerOffsetY` (device px) moves the vertical target off the canvas's
 *  middle — to the middle of the free band between panels that cover it. */
export function fitWidthView(
  canvasWidth: number,
  layout: { cols: number; rows: number; tiles: readonly number[] },
  minZoom: number,
  maxZoom: number,
  centerOffsetY = 0,
): { zoom: number; panX: number; panY: number } {
  const bounds = layoutContentBounds(layout) ?? {
    x: 0,
    y: 0,
    w: layout.cols * TILE_SIZE,
    h: layout.rows * TILE_SIZE,
  };
  const fit = bounds.w > 0 && canvasWidth > 0 ? Math.floor(canvasWidth / bounds.w) : minZoom;
  const zoom = Math.max(minZoom, Math.min(maxZoom, fit));
  // Pan is measured from the grid's centre (pan 0 centres the grid).
  const panX = (layout.cols * TILE_SIZE) / 2 - (bounds.x + bounds.w / 2);
  const panY = (layout.rows * TILE_SIZE) / 2 - (bounds.y + bounds.h / 2);
  return { zoom, panX: panX * zoom, panY: panY * zoom + centerOffsetY };
}
