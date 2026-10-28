import type { AreaLayoutSlice } from '../../core/src/areaRenames.js';
import { diffAreaRenames, renameAreaInMappings } from '../../core/src/areaRenames.js';
import { readConfig, writeConfig } from './configPersistence.js';
import { readLayoutFromFile, writeLayoutToFile } from './layoutPersistence.js';

export interface SavedLayoutRenames {
  renames: Array<[string, string]>;
  /** Present only when a namespace's mappings were rewritten. */
  standaloneMappings?: Record<string, string[]>;
  vscodeMappings?: Record<string, string[]>;
}

/**
 * Persist a layout and carry any Area renames (versus the stored layout) into
 * the Directory→Area mappings of BOTH surfaces. layout.json is shared by the web
 * and VS Code surfaces while mappings are per namespace, so the rewrite covers
 * both in one config write, right beside the layout write.
 */
export function saveLayoutWithAreaRenames(layout: Record<string, unknown>): SavedLayoutRenames {
  const previous = readLayoutFromFile() as AreaLayoutSlice | null;
  const renames = previous ? diffAreaRenames(previous, layout as AreaLayoutSlice) : [];
  writeLayoutToFile(layout);
  const result: SavedLayoutRenames = { renames };
  if (renames.length === 0) return result;

  const cfg = readConfig();
  const standalone = renameAreaInMappings(cfg.standalone.areaMappings ?? {}, renames);
  const vscode = renameAreaInMappings(cfg.vscode.areaMappings ?? {}, renames);
  const standaloneChanged = standalone !== cfg.standalone.areaMappings;
  const vscodeChanged = vscode !== cfg.vscode.areaMappings;
  if (!standaloneChanged && !vscodeChanged) return result;
  cfg.standalone.areaMappings = standalone;
  cfg.vscode.areaMappings = vscode;
  if (!writeConfig(cfg)) return result;
  if (standaloneChanged) result.standaloneMappings = standalone;
  if (vscodeChanged) result.vscodeMappings = vscode;
  return result;
}
