import type { Frame } from "./body";
import type { GlbNodePose, GlbRef, Part, PropDef, PropState } from "./equipment";
import type { PadSurface } from "./equipment";
import type { Vec3 } from "./math";

/**
 * Standardized semantic material slot names used across every canonical GLB machine.
 * Naming every mesh material with one of these slots lets the viewer and iOS/SceneKit
 * recolor or skin machines dynamically without editing any mesh.
 */
export const SEMANTIC_MATERIALS = [
  "mat_frame",
  "mat_pad",
  "mat_chrome",
  "mat_grip",
  "mat_plate",
  "mat_stack",
  "mat_accent",
  "mat_cable",
  "mat_rubber",
  "mat_wood",
] as const;

export type SemanticMaterial = (typeof SEMANTIC_MATERIALS)[number];

export interface MaterialStyle {
  color: string;
  roughness: number;
  metalness: number;
}

export interface MachineSkin {
  id: string;
  label: string;
  materials: Record<SemanticMaterial, MaterialStyle>;
}

/**
 * Per-hand grip pose presets for anatomical finger wrapping and thumb opposition.
 * Legacy GripStyle values ("hang" | "press" | "open") remain accepted and map cleanly.
 */
export const HAND_GRIPS = [
  "bar",
  "press",
  "neutral",
  "hook",
  "open",
  "flat-floor",
  "ball-stop",
  "pinch",
  "fist",
  "relaxed",
  "hang",
] as const;

export type HandGrip = (typeof HAND_GRIPS)[number];

export interface PerHandGrip {
  L: HandGrip;
  R: HandGrip;
  /** Optional handle/bar radius in meters (defaults to 0.015 m) to adapt finger wrap tightness. */
  radiusL?: number;
  radiusR?: number;
}

export type HandGripConfig = HandGrip | PerHandGrip;

/** Exact 3D description of a handle/bar/grip zone on a canonical machine or prop. */
export interface HandleSpec {
  /** World-space center of the grip point. */
  pos: Vec3;
  /** Unit axis along the handle shaft (e.g. [1,0,0] for a barbell, [0,0,1] for parallel dip bars). */
  axis: Vec3;
  /** Preferred unit palm-facing normal (direction the palm pushes or faces toward the handle). */
  palmNormal: Vec3;
  /** Handle cylinder radius in meters. */
  radius: number;
  /** Usable grip length in meters. */
  length: number;
  /** Recommended anatomical hand grip preset. */
  grip: HandGrip;
}

/** Exact 3D description of a cable pulley exit and its optional articulated weight stack. */
export interface PulleySpec {
  /** World-space point where the cable leaves the pulley sheave toward the lifter. */
  pos: Vec3;
  /** Default outward unit direction from the sheave toward the working space. */
  exitDir: Vec3;
  /** Optional GLB node name for the swivel housing/pulley carriage. */
  nodeName?: string;
  /** Optional GLB node name for the linked weight stack. */
  stackNode?: string;
  /** Ratio of weight-stack vertical travel to cable payout (0.5 for 2:1 pulley, 1.0 for 1:1). */
  travelRatio?: number;
}

/** Exact 3D description of a linear rail (45° leg press, hack squat, Smith machine). */
export interface RailSpec {
  /** World-space bind origin of the moving carriage/sled. */
  origin: Vec3;
  /** Unit vector pointing along positive rail travel (typically upward/away). */
  dir: Vec3;
  minTravel: number;
  maxTravel: number;
  /** Optional GLB node name if animated inside a single articulated GLB. */
  nodeName?: string;
}

/** Exact 3D description of a pivoting lever arm or adjustable backrest/seat. */
export interface PivotSpec {
  origin: Vec3;
  axis: Vec3;
  minAngleRad: number;
  maxAngleRad: number;
  nodeName?: string;
}

export interface FootplateSpec {
  surface: PadSurface;
  width: number;
  minAlong: number;
  maxAlong: number;
}

/**
 * Output of instantiating a canonical pre-rigged machine from `src/machines/`.
 * Scenes compose exercises by selecting a canonical machine (single shared GLB, zero copies)
 * and attaching the lifter's body contacts, grips, and movement pattern.
 */
export interface CanonicalMachineInstance {
  /** Canonical machine id (matches `models/machines/<id>.glb` when GLB-backed). */
  id: string;
  name: string;
  /** Canonical GLB attachments (referencing shared `machines/<id>` models, never per-exercise copies). */
  glb: GlbRef[];
  /** GLB-measured static collision & contact surfaces (hidden visually when GLB loads). */
  equipment: Part[];
  /** Default body-to-equipment contact penetration allowances (e.g. upholstery pads, grips). */
  contacts: Record<string, Record<string, number>>;
  /** Optional moving props owned by this machine (e.g. moving sled/barbell/carriage). */
  props?: PropDef[];
  surfaces?: Record<string, PadSurface>;
  footplates?: Record<string, FootplateSpec>;
  handles?: Record<string, HandleSpec>;
  pulleys?: Record<string, PulleySpec>;
  rails?: Record<string, RailSpec>;
  pivots?: Record<string, PivotSpec>;
  hooks?: { pos: Vec3; safetyY?: number }[];
  glbState?: (frame: Frame, extras: number[], propStates: PropState[]) => GlbNodePose[][];
  propState?: (frame: Frame, extras: number[], propStates?: PropState[]) => PropState[];
  cameraHint?: { view?: "Front" | "Back" | "Side" | "Angle" | "Top"; target?: Vec3 };
}
