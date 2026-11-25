import { Color, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { SEMANTIC_MATERIALS, type MachineSkin, type SemanticMaterial } from "./contracts";
import skinsJson from "./machines/skins.json";

/** Shared semantic palettes (`src/machines/skins.json`); Blender bakes the first entry into every GLB. */
export const MACHINE_SKINS: readonly MachineSkin[] = skinsJson as MachineSkin[];

// A theme is the paint on the steel: everything but the frame (chrome, pads, plates, the orange grips and treads) is
// shared, so contact points read the same on every machine in every theme.
for (const skin of MACHINE_SKINS) {
  for (const name of SEMANTIC_MATERIALS) {
    if (!skin.materials[name]) throw new Error(`Skin "${skin.id}" is missing ${name}`);
    if (name !== "mat_frame" && JSON.stringify(skin.materials[name]) !== JSON.stringify(MACHINE_SKINS[0].materials[name])) {
      throw new Error(`Skin "${skin.id}" changes ${name}; themes only repaint mat_frame`);
    }
  }
}

export const DEFAULT_SKIN = MACHINE_SKINS[0];
export const DEFAULT_SKIN_ID = DEFAULT_SKIN.id;

const SEMANTIC_SET = new Set<string>(SEMANTIC_MATERIALS);

export function getSkin(id?: string): MachineSkin {
  return MACHINE_SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;
}

export function machineSkin(id: string): MachineSkin {
  const skin = MACHINE_SKINS.find((s) => s.id === id);
  if (!skin) throw new Error(`Unknown machine skin "${id}"`);
  return skin;
}

/** Strips Blender's `.001` numeric suffix and validates against canonical semantic slots. */
export function normalizeSemanticMaterial(name?: string | null): SemanticMaterial | null {
  if (!name) return null;
  const clean = name.trim().replace(/\.\d+$/, "");
  return SEMANTIC_SET.has(clean) ? (clean as SemanticMaterial) : null;
}

const skinPools = new Map<string, Record<SemanticMaterial, MeshStandardMaterial>>();

function materialsForSkin(skin: MachineSkin): Record<SemanticMaterial, MeshStandardMaterial> {
  const cached = skinPools.get(skin.id);
  if (cached) return cached;
  const pool = {} as Record<SemanticMaterial, MeshStandardMaterial>;
  for (const slot of SEMANTIC_MATERIALS) {
    const spec = skin.materials[slot];
    pool[slot] = new MeshStandardMaterial({
      name: slot,
      color: new Color(spec.color),
      roughness: spec.roughness,
      metalness: spec.metalness,
    });
  }
  skinPools.set(skin.id, pool);
  return pool;
}

/**
 * Applies a semantic color skin to any loaded canonical GLB scene or prop without editing geometry.
 * Returns counts of semantic materials swapped vs. non-semantic materials left untouched.
 */
export function applySkinToObject3D(
  root: Object3D,
  skin: MachineSkin,
): { matched: number; unmatched: string[] } {
  const pool = materialsForSkin(skin);
  let matched = 0;
  const unmatched = new Set<string>();

  const swap = (mat: unknown) => {
    const name = typeof (mat as { name?: string })?.name === "string" ? (mat as { name: string }).name : "";
    const slot = normalizeSemanticMaterial(name);
    if (slot) {
      matched++;
      return pool[slot];
    }
    if (name) unmatched.add(name);
    return mat;
  };

  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => swap(m) as MeshStandardMaterial);
    } else {
      mesh.material = swap(mesh.material) as MeshStandardMaterial;
    }
  });

  return { matched, unmatched: [...unmatched] };
}
