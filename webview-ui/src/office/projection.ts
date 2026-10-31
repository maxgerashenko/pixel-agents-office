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

/** A rectangle in canvas device pixels (origin: the canvas's top-left). */
export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the panels around the office leave free, in canvas device pixels:
 *  `top` is where the space below the top panels starts, `obstacles` are the
 *  panels floating over the canvas (toolbar, zoom buttons). Notifications are
 *  never obstacles — they may cover the office. */
export interface FitSpace {
  top: number;
  obstacles: readonly CanvasRect[];
}

function overlaps(a: CanvasRect, b: CanvasRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The view the fit button sets: the largest whole zoom at which the office's
 *  drawn width fits the canvas and no panel covers it, centred horizontally.
 *  Vertically it is centred below the top panels; when a floating panel
 *  would cover it there, it is centred in the band above the highest
 *  overlapping one instead, and only when neither placement is clear does
 *  the zoom drop a step. Zoom stays an integer so sprites stay pixel-perfect.
 *  Clamped to [minZoom, maxZoom]; without `space` the whole canvas is free. */
export function fitWidthView(
  canvas: { width: number; height: number },
  layout: { cols: number; rows: number; tiles: readonly number[] },
  minZoom: number,
  maxZoom: number,
  space: FitSpace = { top: 0, obstacles: [] },
): { zoom: number; panX: number; panY: number } {
  const bounds = layoutContentBounds(layout) ?? {
    x: 0,
    y: 0,
    w: layout.cols * TILE_SIZE,
    h: layout.rows * TILE_SIZE,
  };
  const widthFit = bounds.w > 0 && canvas.width > 0 ? Math.floor(canvas.width / bounds.w) : minZoom;
  const startZoom = Math.max(minZoom, Math.min(maxZoom, widthFit));
  const cx = canvas.width / 2;
  const rectAt = (zoom: number, cy: number): CanvasRect => ({
    x: cx - (bounds.w * zoom) / 2,
    y: cy - (bounds.h * zoom) / 2,
    w: bounds.w * zoom,
    h: bounds.h * zoom,
  });
  const clear = (r: CanvasRect) =>
    r.y >= space.top - 0.5 && !space.obstacles.some((o) => overlaps(r, o));

  let zoom = startZoom;
  let cy = (space.top + canvas.height) / 2;
  for (let z = startZoom; z >= minZoom; z--) {
    const below = (space.top + canvas.height) / 2;
    if (clear(rectAt(z, below))) {
      zoom = z;
      cy = below;
      break;
    }
    // Above the highest floating panel that would cover it.
    const hits = space.obstacles.filter((o) => overlaps(rectAt(z, below), o));
    const ceiling = Math.min(canvas.height, ...hits.map((o) => o.y));
    const above = (space.top + ceiling) / 2;
    if (clear(rectAt(z, above))) {
      zoom = z;
      cy = above;
      break;
    }
    if (z === minZoom) {
      zoom = z;
      cy = above;
    }
  }
  // Pan is measured from the grid's centre (pan 0 centres the grid).
  const panX = ((layout.cols * TILE_SIZE) / 2 - (bounds.x + bounds.w / 2)) * zoom;
  const panY =
    ((layout.rows * TILE_SIZE) / 2 - (bounds.y + bounds.h / 2)) * zoom + (cy - canvas.height / 2);
  return { zoom, panX, panY };
}
