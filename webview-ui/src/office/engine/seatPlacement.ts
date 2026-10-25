/**
 * Pure seat-placement helpers, extracted from OfficeState so they can be unit
 * tested without pulling the canvas/DOM-touching engine into the Node test
 * project (mirrors officeCanvasCursor.ts). Structural types keep this module
 * dependency-free — OfficeState's real Seat/Character satisfy them.
 */

export interface SeatLike {
  seatCol: number;
  seatRow: number;
  assigned: boolean;
}

export interface AnchorLike {
  seatId: string | null;
  tileCol: number;
  tileRow: number;
}

/**
 * The tile a teammate should cluster around: its lead's SEAT when the lead has
 * one, otherwise the lead's live tile. A lead is assigned its seat at creation
 * but may still be walking toward it when the teammate is placed; anchoring to
 * the stable seat (not the transient walking tile) keeps clustering deterministic
 * so a closer free seat can't open up once the lead lands. Returns undefined when
 * there is no anchor at all.
 */
export function anchorTile(
  anchor: AnchorLike | undefined,
  seats: ReadonlyMap<string, SeatLike>,
): { col: number; row: number } | undefined {
  if (!anchor) return undefined;
  const seat = anchor.seatId ? seats.get(anchor.seatId) : undefined;
  return seat
    ? { col: seat.seatCol, row: seat.seatRow }
    : { col: anchor.tileCol, row: anchor.tileRow };
}

/**
 * Free seat closest (Manhattan) to a tile — seats teammates beside their lead.
 * `eligible` restricts the search to those seat uids (the work seats).
 */
export function closestFreeSeat(
  seats: ReadonlyMap<string, SeatLike>,
  col: number,
  row: number,
  eligible?: ReadonlySet<string>,
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [uid, seat] of seats) {
    if (seat.assigned || (eligible && !eligible.has(uid))) continue;
    const d = Math.abs(seat.seatCol - col) + Math.abs(seat.seatRow - row);
    if (d < bestDist) {
      best = uid;
      bestDist = d;
    }
  }
  return best;
}

/** Every Area label actually painted on at least one tile of the layout. */
export function paintedAreaLabels(
  areaTiles: ReadonlyArray<string | null | undefined> | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!areaTiles) return out;
  for (const label of areaTiles) if (label) out.add(label);
  return out;
}

/**
 * The Area labels an agent may work in, or null when it is unmapped. Mapped
 * labels painted nowhere in the layout are dropped; if none survive the agent
 * is treated as unmapped (it must not be locked out of every seat by a stale
 * mapping).
 */
export function workLabelsFor(
  mapped: readonly string[] | undefined,
  painted: ReadonlySet<string>,
): Set<string> | null {
  if (!mapped) return null;
  const live = mapped.filter((l) => painted.has(l));
  return live.length > 0 ? new Set(live) : null;
}

/**
 * The seat rule. A mapped agent (`work` non-null) may sit only inside one of
 * its labels; an unmapped agent (`work` null) only outside every Area. No
 * fallback either way. `zone` is the seat tile's Area label, or null.
 */
export function seatSatisfiesRule(zone: string | null, work: ReadonlySet<string> | null): boolean {
  return work ? zone !== null && work.has(zone) : zone === null;
}

/** Area label at a tile, or null when the tile is unzoned (or there are no areas). */
export function zoneAt(
  areaTiles: ReadonlyArray<string | null> | undefined,
  cols: number,
  col: number,
  row: number,
): string | null {
  if (!areaTiles || areaTiles.length === 0) return null;
  if (col < 0 || col >= cols || row < 0) return null;
  return areaTiles[row * cols + col] ?? null;
}
