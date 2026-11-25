import { Color, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { SEMANTIC_MATERIALS, type MachineSkin, type SemanticMaterial } from "./contracts";

export const MACHINE_SKINS: readonly MachineSkin[] = [
  {
    id: "studio-graphite",
    label: "Studio Graphite",
    materials: {
      mat_frame: { color: "#323740", roughness: 0.48, metalness: 0.42 },
      mat_pad: { color: "#21242a", roughness: 0.86, metalness: 0.04 },
      mat_chrome: { color: "#ced4dd", roughness: 0.24, metalness: 0.86 },
      mat_grip: { color: "#191c20", roughness: 0.92, metalness: 0.02 },
      mat_plate: { color: "#252932", roughness: 0.56, metalness: 0.28 },
      mat_stack: { color: "#2c313a", roughness: 0.52, metalness: 0.35 },
      mat_accent: { color: "#276ef1", roughness: 0.42, metalness: 0.25 },
      mat_cable: { color: "#7f8999", roughness: 0.36, metalness: 0.7 },
      mat_rubber: { color: "#16181c", roughness: 0.94, metalness: 0.02 },
      mat_wood: { color: "#c29b6e", roughness: 0.76, metalness: 0.04 },
    },
  },
  {
    id: "arctic-steel",
    label: "Arctic Steel",
    materials: {
      mat_frame: { color: "#d7dde6", roughness: 0.42, metalness: 0.28 },
      mat_pad: { color: "#2d333d", roughness: 0.85, metalness: 0.04 },
      mat_chrome: { color: "#e2e7ef", roughness: 0.2, metalness: 0.88 },
      mat_grip: { color: "#1d2128", roughness: 0.9, metalness: 0.02 },
      mat_plate: { color: "#2f3540", roughness: 0.54, metalness: 0.26 },
      mat_stack: { color: "#414957", roughness: 0.48, metalness: 0.32 },
      mat_accent: { color: "#0ea5e9", roughness: 0.38, metalness: 0.22 },
      mat_cable: { color: "#8892a2", roughness: 0.35, metalness: 0.7 },
      mat_rubber: { color: "#1f232a", roughness: 0.92, metalness: 0.02 },
      mat_wood: { color: "#d0b088", roughness: 0.74, metalness: 0.04 },
    },
  },
  {
    id: "obsidian-crimson",
    label: "Obsidian Crimson",
    materials: {
      mat_frame: { color: "#1b1e23", roughness: 0.52, metalness: 0.38 },
      mat_pad: { color: "#231e20", roughness: 0.86, metalness: 0.04 },
      mat_chrome: { color: "#bcc4d0", roughness: 0.24, metalness: 0.86 },
      mat_grip: { color: "#14161a", roughness: 0.94, metalness: 0.02 },
      mat_plate: { color: "#1f2228", roughness: 0.56, metalness: 0.28 },
      mat_stack: { color: "#262930", roughness: 0.5, metalness: 0.35 },
      mat_accent: { color: "#dc2626", roughness: 0.38, metalness: 0.25 },
      mat_cable: { color: "#7c8594", roughness: 0.36, metalness: 0.7 },
      mat_rubber: { color: "#131519", roughness: 0.95, metalness: 0.02 },
      mat_wood: { color: "#a8835a", roughness: 0.78, metalness: 0.04 },
    },
  },
  {
    id: "cobalt-pro",
    label: "Cobalt Pro",
    materials: {
      mat_frame: { color: "#1f3a60", roughness: 0.44, metalness: 0.36 },
      mat_pad: { color: "#1e222a", roughness: 0.86, metalness: 0.04 },
      mat_chrome: { color: "#d5dce6", roughness: 0.22, metalness: 0.86 },
      mat_grip: { color: "#171a20", roughness: 0.92, metalness: 0.02 },
      mat_plate: { color: "#252b36", roughness: 0.55, metalness: 0.26 },
      mat_stack: { color: "#2d3544", roughness: 0.48, metalness: 0.34 },
      mat_accent: { color: "#3b82f6", roughness: 0.36, metalness: 0.24 },
      mat_cable: { color: "#8a94a6", roughness: 0.35, metalness: 0.7 },
      mat_rubber: { color: "#15181e", roughness: 0.94, metalness: 0.02 },
      mat_wood: { color: "#c29b6e", roughness: 0.76, metalness: 0.04 },
    },
  },
  {
    id: "forest-brass",
    label: "Forest & Brass",
    materials: {
      mat_frame: { color: "#253a30", roughness: 0.48, metalness: 0.34 },
      mat_pad: { color: "#2c241e", roughness: 0.86, metalness: 0.04 },
      mat_chrome: { color: "#ccb584", roughness: 0.28, metalness: 0.84 },
      mat_grip: { color: "#1a1715", roughness: 0.92, metalness: 0.02 },
      mat_plate: { color: "#262825", roughness: 0.58, metalness: 0.26 },
      mat_stack: { color: "#2f332e", roughness: 0.52, metalness: 0.32 },
      mat_accent: { color: "#d97706", roughness: 0.38, metalness: 0.28 },
      mat_cable: { color: "#8c897d", roughness: 0.36, metalness: 0.68 },
      mat_rubber: { color: "#181715", roughness: 0.94, metalness: 0.02 },
      mat_wood: { color: "#b68e62", roughness: 0.76, metalness: 0.04 },
    },
  },
] as const;

export const DEFAULT_SKIN_ID = MACHINE_SKINS[0].id;

const SEMANTIC_SET = new Set<string>(SEMANTIC_MATERIALS);

export function getSkin(id?: string): MachineSkin {
  return MACHINE_SKINS.find((s) => s.id === id) ?? MACHINE_SKINS[0];
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
