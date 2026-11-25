import { SEMANTIC_MATERIALS, type MachineSkin } from "../contracts";
import skinsJson from "./skins.json";

/** Palettes keyed by semantic material name. `scripts/machines/lib.py` bakes the first one into every GLB. */
export const MACHINE_SKINS: MachineSkin[] = skinsJson as MachineSkin[];

for (const skin of MACHINE_SKINS) {
  for (const name of SEMANTIC_MATERIALS) {
    if (!skin.materials[name]) throw new Error(`Skin "${skin.id}" is missing ${name}`);
  }
}

export const DEFAULT_SKIN = MACHINE_SKINS[0];

export function machineSkin(id: string): MachineSkin {
  const skin = MACHINE_SKINS.find((s) => s.id === id);
  if (!skin) throw new Error(`Unknown machine skin "${id}"`);
  return skin;
}
