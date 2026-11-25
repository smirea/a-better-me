import { SIDES, sideSign, type Angles, type Side } from "./body";
import { clamp, rad } from "./math";

/** The app's 23 muscle groups, as `exercises.json` names them. */
export const MUSCLES = [
  "chest",
  "front_delts",
  "side_delts",
  "rear_delts",
  "lats",
  "upper_back",
  "upper_traps",
  "serratus",
  "biceps",
  "triceps",
  "forearms",
  "neck",
  "abs",
  "obliques",
  "lower_back",
  "glutes",
  "hip_flexors",
  "abductors",
  "adductors",
  "quads",
  "hamstrings",
  "calves",
  "tibs",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: "Chest",
  front_delts: "Front delts",
  side_delts: "Side delts",
  rear_delts: "Rear delts",
  lats: "Lats",
  upper_back: "Upper back",
  upper_traps: "Upper traps",
  serratus: "Serratus",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  neck: "Neck",
  abs: "Abs",
  obliques: "Obliques",
  lower_back: "Lower back",
  glutes: "Glutes",
  hip_flexors: "Hip flexors",
  abductors: "Abductors",
  adductors: "Adductors",
  quads: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  tibs: "Tibialis",
};

/** The tendon or sheet of connective tissue that carries each group's pull to bone. */
export const TENDONS: Record<Muscle, string> = {
  chest: "Pectoralis major tendon",
  front_delts: "Anterior deltoid insertion",
  side_delts: "Deltoid insertion",
  rear_delts: "Posterior deltoid insertion",
  lats: "Latissimus tendon",
  upper_back: "Rhomboid and mid-trapezius attachments",
  upper_traps: "Upper trapezius attachment",
  serratus: "Serratus attachments",
  biceps: "Distal biceps tendon",
  triceps: "Triceps tendon",
  forearms: "Wrist and finger flexor tendons",
  neck: "Cervical attachments",
  abs: "Rectus sheath",
  obliques: "Oblique aponeurosis",
  lower_back: "Thoracolumbar fascia",
  glutes: "Gluteal tendon",
  hip_flexors: "Iliopsoas tendon",
  abductors: "Gluteus medius tendon",
  adductors: "Adductor tendon",
  quads: "Patellar tendon",
  hamstrings: "Proximal hamstring tendon",
  calves: "Achilles tendon",
  tibs: "Tibialis anterior tendon",
};

export interface Actuator {
  muscle: Muscle;
  side: Side;
  /** The torque in N·m this actuator adds to each demand at full activation; `grip` entries are in newtons. */
  entries: { dof: string; capacity: number; scale?: (angles: Angles) => number }[];
}

/**
 * Peak isometric torque each muscle group can add at each joint motion, for a trained 80 kg lifter. A group that
 * crosses two joints in the plane of the lift pulls on both at once.
 * These are first-order figures from strength norms, not a musculoskeletal model: moment arms don't change with
 * joint angle (except where `scale` says so) and nothing wraps around bone.
 */
export function createActuators(): Actuator[] {
  const actuators: Actuator[] = [];
  for (const side of SIDES) {
    const s = sideSign(side);
    const add = (muscle: Muscle, entries: [string, number, ((angles: Angles) => number)?][]) =>
      actuators.push({
        muscle,
        side,
        entries: entries.map(([dof, capacity, scale]) => ({ dof, capacity, scale })),
      });
    const j = (joint: string, motion: string) => `${joint}_${side}.${motion}`;
    const hipFlexion = (angles: Angles) => angles[j("hip", "flex")];

    // A group gets one actuator per motion it produces, and its activation is the highest of them. Only the
    // two-joint couplings in the plane of the lift stay tied together, because those are what make a lift
    // favour one muscle over another: hamstrings that extend the hip also flex the knee, which the quads
    // then have to overcome.
    add("quads", [
      [j("knee", "flex"), -300],
      [j("hip", "flex"), 30],
    ]);
    // The hamstrings lose leverage at the hip as it flexes deeply, while adductor magnus gains it.
    add("hamstrings", [
      [j("hip", "flex"), -100, (a) => clamp(1.28 - hipFlexion(a) / rad(160), 0.55, 1)],
      [j("knee", "flex"), 120],
    ]);
    add("glutes", [[j("hip", "flex"), -220]]);
    add("glutes", [[j("hip", "rot"), 45]]);
    add("adductors", [[j("hip", "flex"), -120, (a) => clamp(hipFlexion(a) / rad(60), 0.15, 1)]]);
    add("adductors", [[j("hip", "abd"), -130]]);
    add("abductors", [[j("hip", "abd"), 110]]);
    add("abductors", [[j("hip", "rot"), -25]]);
    add("hip_flexors", [[j("hip", "flex"), 110]]);
    add("calves", [
      [j("ankle", "dorsi"), -200],
      [j("knee", "flex"), 25],
    ]);
    add("tibs", [[j("ankle", "dorsi"), 45]]);

    // Each spinal level gets its own actuator: one spanning both would have to co-contract against the abs
    // whenever the two levels need torque in a different ratio than its fixed moment arms give.
    add("lower_back", [
      ["lumbar.flex", -220],
      ["lumbar.bend", s * 45],
    ]);
    add("lower_back", [
      ["thoracic.flex", -160],
      ["thoracic.bend", s * 35],
    ]);
    add("abs", [["lumbar.flex", 80]]);
    add("abs", [["thoracic.flex", 65]]);
    add("obliques", [
      ["lumbar.flex", 35],
      ["lumbar.bend", s * 60],
    ]);
    add("obliques", [
      ["thoracic.flex", 25],
      ["thoracic.bend", s * 45],
    ]);
    add("obliques", [
      ["lumbar.twist", 30],
      ["thoracic.twist", 40],
    ]);
    add("obliques", [
      ["lumbar.twist", -30],
      ["thoracic.twist", -40],
    ]);
    add("neck", [
      ["neck.flex", 18],
      ["neck.bend", s * 8],
    ]);
    add("neck", [
      ["neck.flex", -30],
      ["neck.bend", s * 8],
    ]);
    add("neck", [["neck.twist", s * 6]]);

    add("upper_traps", [[j("clavicle", "elev"), 130]]);
    add("upper_traps", [
      ["neck.flex", -10],
      ["neck.bend", s * 10],
    ]);
    add("serratus", [[j("clavicle", "prot"), 125]]);
    add("upper_back", [[j("clavicle", "prot"), -90]]);
    add("upper_back", [[j("clavicle", "elev"), -60]]);
    add("upper_back", [[j("shoulder", "hadd"), -30]]);
    add("chest", [[j("shoulder", "hadd"), 90]]);
    // With the upper arm out to the side, turning it about the chest's side-to-side axis is mostly rolling the
    // humerus inward, which the pecs do far more strongly than they flex a hanging arm.
    add("chest", [
      [
        j("shoulder", "flex"),
        1,
        (a) =>
          25 +
          55 * Math.sin(a[j("shoulder", "elev")]) * Math.abs(Math.cos(a[j("shoulder", "plane")])),
      ],
    ]);
    add("chest", [[j("shoulder", "abd"), -35]]);
    add("lats", [[j("shoulder", "flex"), -90]]);
    add("lats", [[j("shoulder", "abd"), -85]]);
    add("lats", [[j("clavicle", "elev"), -65]]);
    add("front_delts", [[j("shoulder", "flex"), 65]]);
    add("front_delts", [[j("shoulder", "hadd"), 30]]);
    add("front_delts", [[j("shoulder", "abd"), 25]]);
    add("side_delts", [[j("shoulder", "abd"), 65]]);
    add("rear_delts", [[j("shoulder", "hadd"), -45]]);
    add("rear_delts", [[j("shoulder", "flex"), -30]]);
    add("biceps", [
      [j("elbow", "flex"), 70],
      [j("shoulder", "flex"), 12],
    ]);
    add("triceps", [
      [j("elbow", "flex"), -85],
      [j("shoulder", "flex"), -12],
    ]);
    add("forearms", [[j("elbow", "flex"), 18]]);
    add("forearms", [[j("wrist", "flex"), 24]]);
    add("forearms", [[j("wrist", "flex"), -18]]);
    add("forearms", [[j("wrist", "dev"), 14]]);
    add("forearms", [[j("wrist", "dev"), -14]]);
    add("forearms", [[j("forearm", "pron"), 9]]);
    add("forearms", [[j("forearm", "pron"), -6]]);
    add("forearms", [[`grip_${side}`, 550]]);
  }
  return actuators;
}

/** How far behind the plane of the chest the upper arm points, in radians. */
const armBehind = (a: Angles, side: Side) =>
  Math.asin(
    clamp(-Math.sin(a[`shoulder_${side}.elev`]) * Math.sin(a[`shoulder_${side}.plane`]), -1, 1),
  );
const spineFlexion = (a: Angles) => a["lumbar.flex"] + a["thoracic.flex"];

interface StretchModel {
  /** Muscle-tendon length against the neutral standing pose, in metres, from moment arms times joint angles. */
  length: (a: Angles, side: Side) => number;
  /** The length at the end of the joint's passive range, which reads as a full stretch. */
  full: number;
}

const STRETCH: Record<Muscle, StretchModel> = {
  chest: {
    length: (a, side) =>
      0.07 * armBehind(a, side) +
      0.02 *
        Math.sin(a[`shoulder_${side}.elev`]) *
        Math.max(0, Math.cos(a[`shoulder_${side}.plane`])) -
      0.01 * a[`shoulder_${side}.twist`],
    full: 0.07 * rad(55) + 0.02 * Math.cos(rad(40)) + 0.01 * rad(60),
  },
  front_delts: { length: (a, side) => 0.04 * armBehind(a, side), full: 0.04 * rad(65) },
  side_delts: { length: (a, side) => -0.02 * a[`shoulder_${side}.abd`], full: 0.02 * rad(35) },
  rear_delts: {
    length: (a, side) =>
      0.05 *
      Math.max(0, a[`shoulder_${side}.plane`] - rad(90)) *
      Math.sin(a[`shoulder_${side}.elev`]),
    full: 0.05 * rad(50),
  },
  lats: {
    length: (a, side) =>
      0.05 *
      a[`shoulder_${side}.elev`] *
      Math.max(0, Math.sin(a[`shoulder_${side}.plane`] / 2 + rad(45))),
    full: 0.05 * rad(180),
  },
  upper_back: { length: (a, side) => 0.03 * a[`clavicle_${side}.prot`], full: 0.03 * rad(25) },
  upper_traps: {
    length: (a, side) => -0.03 * a[`clavicle_${side}.elev`] + 0.02 * a["neck.flex"],
    full: 0.03 * rad(10) + 0.02 * rad(40),
  },
  serratus: { length: (a, side) => -0.03 * a[`clavicle_${side}.prot`], full: 0.03 * rad(36) },
  biceps: {
    length: (a, side) =>
      -0.04 * a[`elbow_${side}.flex`] +
      0.02 * armBehind(a, side) +
      0.004 * a[`forearm_${side}.pron`],
    full: 0.02 * rad(50) + 0.004 * rad(80),
  },
  triceps: {
    length: (a, side) =>
      0.022 * a[`elbow_${side}.flex`] + 0.012 * Math.max(0, a[`shoulder_${side}.flex`]),
    full: 0.022 * rad(150) + 0.012 * rad(170),
  },
  forearms: {
    length: (a, side) => 0.015 * Math.abs(a[`wrist_${side}.flex`]),
    full: 0.015 * rad(70),
  },
  neck: { length: (a) => 0.02 * Math.abs(a["neck.flex"]), full: 0.02 * rad(50) },
  abs: { length: (a) => -0.05 * spineFlexion(a), full: 0.05 * rad(45) },
  obliques: {
    length: (a, side) => -sideSign(side) * 0.05 * (a["lumbar.bend"] + a["thoracic.bend"]),
    full: 0.05 * rad(45),
  },
  lower_back: { length: (a) => 0.05 * spineFlexion(a), full: 0.05 * rad(85) },
  glutes: { length: (a, side) => 0.05 * a[`hip_${side}.flex`], full: 0.05 * rad(135) },
  hip_flexors: { length: (a, side) => -0.04 * a[`hip_${side}.flex`], full: 0.04 * rad(20) },
  abductors: { length: (a, side) => -0.05 * a[`hip_${side}.abd`], full: 0.05 * rad(25) },
  adductors: {
    length: (a, side) => 0.06 * a[`hip_${side}.abd`] + 0.02 * a[`hip_${side}.flex`],
    full: 0.06 * rad(45) + 0.02 * rad(90),
  },
  quads: {
    length: (a, side) => 0.042 * a[`knee_${side}.flex`] - 0.012 * a[`hip_${side}.flex`],
    full: 0.042 * rad(150),
  },
  hamstrings: {
    length: (a, side) => 0.06 * a[`hip_${side}.flex`] - 0.035 * a[`knee_${side}.flex`],
    full: 0.06 * rad(90),
  },
  calves: {
    length: (a, side) => 0.045 * a[`ankle_${side}.dorsi`] - 0.015 * a[`knee_${side}.flex`],
    full: 0.045 * rad(30),
  },
  tibs: { length: (a, side) => -0.04 * a[`ankle_${side}.dorsi`], full: 0.04 * rad(45) },
};

/** 0 at the standing length or shorter, 1 at the end of the passive range. Above 1 is past what the joint allows. */
export const stretchOf = (muscle: Muscle, angles: Angles, side: Side) =>
  clamp(STRETCH[muscle].length(angles, side) / STRETCH[muscle].full, 0, 1.5);

/** Passive tension a lengthened muscle adds, as a fraction of its peak active force. It starts at 60% stretch. */
export const passiveForce = (stretch: number) =>
  stretch <= 0.6 ? 0 : 0.5 * ((stretch - 0.6) / 0.4) ** 2;

/** Tendon strain at peak isometric muscle force, from Millard et al. (2013). */
export const TENDON_STRAIN_AT_PEAK = 4.9;
