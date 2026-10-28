// Area rename detection and Directory→Area mapping rewrite. Pure: shared by the
// webview (local state) and the server (persisted layout + mappings).

/** The slice of a layout that identifies Areas. Structural, so core stays free of webview types. */
export interface AreaLayoutSlice {
  areas?: ReadonlyArray<{ label: string }>;
  areaTiles?: ReadonlyArray<string | null>;
}

/** Tile indices painted with `label`, as a stable key; '' when the Area has no tiles. */
function tileKey(areaTiles: ReadonlyArray<string | null> | undefined, label: string): string {
  if (!areaTiles) return '';
  const idx: number[] = [];
  for (let i = 0; i < areaTiles.length; i++) if (areaTiles[i] === label) idx.push(i);
  return idx.join(',');
}

/**
 * Renames between two layouts, as `[old, new]` pairs. Labels present on both
 * sides are unchanged. Of the leftovers (old-only, new-only), pairs are matched
 * first by identical non-empty tile sets (unique match only), then by sitting at
 * the same index of the `areas` array. Anything else is an add or a remove.
 * Undo/redo diffs fall out for free (the reverse pair).
 */
export function diffAreaRenames(
  prev: AreaLayoutSlice | undefined,
  next: AreaLayoutSlice | undefined,
): Array<[string, string]> {
  const prevAreas = prev?.areas ?? [];
  const nextAreas = next?.areas ?? [];
  if (prevAreas.length === 0 || nextAreas.length === 0) return [];
  const prevLabels = new Set(prevAreas.map((a) => a.label));
  const nextLabels = new Set(nextAreas.map((a) => a.label));
  const removed = prevAreas.map((a) => a.label).filter((l) => !nextLabels.has(l));
  const added = nextAreas.map((a) => a.label).filter((l) => !prevLabels.has(l));
  if (removed.length === 0 || added.length === 0) return [];

  const renames: Array<[string, string]> = [];
  const pairedFrom = new Set<string>();
  const pairedTo = new Set<string>();

  // 1. Identical, non-empty tile sets; both sides must be unambiguous.
  const removedByKey = new Map<string, string[]>();
  for (const l of removed) {
    const key = tileKey(prev?.areaTiles, l);
    if (key) removedByKey.set(key, [...(removedByKey.get(key) ?? []), l]);
  }
  const addedByKey = new Map<string, string[]>();
  for (const l of added) {
    const key = tileKey(next?.areaTiles, l);
    if (key) addedByKey.set(key, [...(addedByKey.get(key) ?? []), l]);
  }
  for (const [key, froms] of removedByKey) {
    const tos = addedByKey.get(key);
    if (froms.length === 1 && tos?.length === 1) {
      renames.push([froms[0], tos[0]]);
      pairedFrom.add(froms[0]);
      pairedTo.add(tos[0]);
    }
  }

  // 2. Same index in the areas array.
  const len = Math.min(prevAreas.length, nextAreas.length);
  for (let i = 0; i < len; i++) {
    const from = prevAreas[i].label;
    const to = nextAreas[i].label;
    if (from === to || nextLabels.has(from) || prevLabels.has(to)) continue;
    if (pairedFrom.has(from) || pairedTo.has(to)) continue;
    renames.push([from, to]);
    pairedFrom.add(from);
    pairedTo.add(to);
  }
  return renames;
}

/**
 * Rewrite Directory→Area mappings for renamed areas. Keys (Directory names) are
 * untouched; label values are replaced and deduped per directory, keeping first
 * occurrence order. Returns the same object when nothing changed.
 */
export function renameAreaInMappings(
  mappings: Record<string, string[]>,
  renames: ReadonlyArray<[string, string]>,
): Record<string, string[]> {
  if (renames.length === 0) return mappings;
  const renameMap = new Map(renames);
  let changed = false;
  const result: Record<string, string[]> = {};
  for (const [dir, labels] of Object.entries(mappings)) {
    const mapped = labels.map((l) => renameMap.get(l) ?? l);
    const deduped = mapped.filter((l, i) => mapped.indexOf(l) === i);
    if (deduped.length !== labels.length || deduped.some((l, i) => l !== labels[i])) {
      changed = true;
      result[dir] = deduped;
    } else {
      result[dir] = labels;
    }
  }
  return changed ? result : mappings;
}
