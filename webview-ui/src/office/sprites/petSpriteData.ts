import { PET_HUG_FRAME_PX, PET_HUG_REAR_DEG } from '../../constants.js';
import type { PetKind, SpriteData } from '../types.js';
import { PetKind as PetKinds } from '../types.js';

/**
 * Resolved per-pet sprite frames. Each entry is a 3-frame animation array.
 * `walkLeft` / `idleRight` / `idleLeft` are derived in setPetTemplates from
 * the broadcast fields.
 */
export interface PetSpriteFrames {
  walkDown: [SpriteData, SpriteData, SpriteData];
  idleDown: [SpriteData, SpriteData, SpriteData];
  walkUp: [SpriteData, SpriteData, SpriteData];
  idleUp: [SpriteData, SpriteData, SpriteData];
  walkRight: [SpriteData, SpriteData, SpriteData];
  walkLeft: [SpriteData, SpriteData, SpriteData];
  idleRight: [SpriteData, SpriteData, SpriteData];
  idleLeft: [SpriteData, SpriteData, SpriteData];
  /** Dog reared up on its hind legs clinging to a leg on its right (derived
   *  from walkRight tipped back onto its hind legs). */
  hugRight: [SpriteData, SpriteData, SpriteData];
  /** Same, clinging to a leg on its left. */
  hugLeft: [SpriteData, SpriteData, SpriteData];
}

/** Flip a sprite horizontally (used for walkRight → walkLeft). */
function flipHorizontal(s: SpriteData): SpriteData {
  return s.map((row) => [...row].reverse());
}

/**
 * Rotate a sprite counter-clockwise by `deg` (nearest-neighbour, so no new
 * colours), into a canvas big enough to hold the result.
 */
function rotateCcw(s: SpriteData, deg: number): SpriteData {
  const h = s.length;
  const w = h > 0 ? s[0].length : 0;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const outW = Math.ceil(Math.abs(w * cos) + Math.abs(h * sin));
  const outH = Math.ceil(Math.abs(w * sin) + Math.abs(h * cos));
  const out: SpriteData = [];
  for (let y = 0; y < outH; y++) {
    const row: string[] = [];
    for (let x = 0; x < outW; x++) {
      // Inverse-map the destination pixel centre back into the source
      const dx = x + 0.5 - outW / 2;
      const dy = y + 0.5 - outH / 2;
      const sx = Math.floor(dx * cos - dy * sin + w / 2);
      const sy = Math.floor(dx * sin + dy * cos + h / 2);
      row.push(sx >= 0 && sx < w && sy >= 0 && sy < h ? s[sy][sx] : '');
    }
    out.push(row);
  }
  return out;
}

/** Opaque bounds of a sprite: [minCol, minRow, maxCol, maxRow], or null when empty. */
function opaqueBounds(s: SpriteData): [number, number, number, number] | null {
  let b: [number, number, number, number] | null = null;
  s.forEach((row, r) =>
    row.forEach((px, c) => {
      if (px === '') return;
      if (!b) b = [c, r, c, r];
      else b = [Math.min(b[0], c), Math.min(b[1], r), Math.max(b[2], c), Math.max(b[3], r)];
    }),
  );
  return b;
}

/**
 * Hug frames, clinging to a leg on the dog's right: the side walk frames tipped
 * back onto the hind legs (PET_HUG_REAR_DEG), then laid into a
 * PET_HUG_FRAME_PX square with the paws and nose against its right edge and the
 * feet on its bottom edge — one shared offset, so the frames don't jitter.
 */
function hugFrames(
  walkRight: [SpriteData, SpriteData, SpriteData],
): [SpriteData, SpriteData, SpriteData] {
  const turned = walkRight.map((f) => rotateCcw(f, PET_HUG_REAR_DEG));
  const bounds = turned.map(opaqueBounds);
  const right = Math.max(...bounds.map((b) => (b ? b[2] : 0)));
  const bottom = Math.max(...bounds.map((b) => (b ? b[3] : 0)));
  const size = PET_HUG_FRAME_PX;
  const place = (f: SpriteData): SpriteData =>
    Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => {
        const sy = y - (size - 1 - bottom);
        const sx = x - (size - 1 - right);
        return f[sy]?.[sx] ?? '';
      }),
    );
  return [place(turned[0]), place(turned[1]), place(turned[2])];
}

/** Coerce a 3-frame raw array to a fixed-length tuple. Caller must verify len ≥ 3 first. */
function toTriple(arr: string[][][]): [SpriteData, SpriteData, SpriteData] {
  return [arr[0], arr[1], arr[2]];
}

let loadedPets: PetSpriteFrames[] | null = null;
let loadedPetNames: string[] = [];
let loadedPetKinds: PetKind[] = [];

/**
 * Receive raw frame arrays + parallel display names from the server message.
 * Skips entries with fewer than 3 frames in any of the required directions.
 */
export function setPetTemplates(
  data: Array<{
    walkDown: string[][][];
    idleDown: string[][][];
    walkUp: string[][][];
    idleUp: string[][][];
    walkRight: string[][][];
  }>,
  petNames?: string[],
  petKinds?: string[],
): void {
  const resolved: PetSpriteFrames[] = [];
  const resolvedNames: string[] = [];
  const resolvedKinds: PetKind[] = [];
  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    if (
      !raw ||
      !raw.walkDown ||
      raw.walkDown.length < 3 ||
      !raw.idleDown ||
      raw.idleDown.length < 3 ||
      !raw.walkUp ||
      raw.walkUp.length < 3 ||
      !raw.idleUp ||
      raw.idleUp.length < 3 ||
      !raw.walkRight ||
      raw.walkRight.length < 3
    ) {
      continue;
    }
    const walkDown = toTriple(raw.walkDown);
    const idleDown = toTriple(raw.idleDown);
    const walkUp = toTriple(raw.walkUp);
    const idleUp = toTriple(raw.idleUp);
    const walkRight = toTriple(raw.walkRight);
    const walkLeft: [SpriteData, SpriteData, SpriteData] = [
      flipHorizontal(walkRight[0]),
      flipHorizontal(walkRight[1]),
      flipHorizontal(walkRight[2]),
    ];
    // The pet's front-facing idle stands in for "idle right"; the back-facing
    // idle stands in for "idle left". No flip — the side-on pose isn't authored.
    const hugRight = hugFrames(walkRight);
    const hugLeft: [SpriteData, SpriteData, SpriteData] = [
      flipHorizontal(hugRight[0]),
      flipHorizontal(hugRight[1]),
      flipHorizontal(hugRight[2]),
    ];
    resolved.push({
      hugRight,
      hugLeft,
      walkDown,
      idleDown,
      walkUp,
      idleUp,
      walkRight,
      walkLeft,
      idleRight: idleDown,
      idleLeft: idleUp,
    });
    resolvedNames.push(petNames?.[i] ?? `Pet ${i + 1}`);
    resolvedKinds.push(toPetKind(petKinds?.[i]));
  }
  loadedPets = resolved;
  loadedPetNames = resolvedNames;
  loadedPetKinds = resolvedKinds;
}

/** Returns the resolved frames for a petType, or null if not loaded or out of range. */
export function getPetSprites(petIndex: number): PetSpriteFrames | null {
  if (!loadedPets) return null;
  if (petIndex < 0 || petIndex >= loadedPets.length) return null;
  return loadedPets[petIndex];
}

/** Number of pets currently loaded. */
export function getPetCount(): number {
  return loadedPets?.length ?? 0;
}

/** Display name for a petType. Falls back to "Pet N" when manifest missing. */
export function getPetName(petIndex: number): string {
  return loadedPetNames[petIndex] ?? `Pet ${petIndex + 1}`;
}

/** A manifest's `kind` string as a PetKind; anything unrecognised is OTHER. */
function toPetKind(raw: string | undefined): PetKind {
  const kind = raw?.toLowerCase();
  if (kind === PetKinds.DOG || kind === PetKinds.CAT) return kind;
  return PetKinds.OTHER;
}

/** Species of a petType (from its manifest's `kind`); OTHER when unknown. */
export function getPetKind(petIndex: number): PetKind {
  return loadedPetKinds[petIndex] ?? PetKinds.OTHER;
}
