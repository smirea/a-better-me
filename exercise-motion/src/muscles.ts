import { SIDES, sideSign, type Angles, type Side } from "./body";
import { clamp, deg, rad } from "./math";

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
  /** The group it shows as, or null for a muscle the app has no group for: it carries its torque and shows nowhere. */
  muscle: Muscle | null;
  side: Side;
  /**
   * The torque in N·m this actuator adds to each joint motion at full activation, at the joint angle where it is
   * strongest; `scale` is the fraction of that left at the current angle. `grip` entries are in newtons.
   */
  entries: { dof: string; capacity: number; scale?: (angles: Angles) => number }[];
}

/** The fraction of peak torque left at each joint angle, in degrees, read off a measured strength curve. */
const curve = (dof: string, points: [number, number][]) => (angles: Angles) => {
  const x = deg(angles[dof]);
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x > x1) continue;
    const [x0, y0] = points[i - 1];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
};

/**
 * Peak isometric torque each muscle group can add at each joint motion, for a trained 80 kg man. A group that
 * crosses two joints pulls on both at once. These are torque generators, not a musculoskeletal model: nothing wraps
 * around bone, and a moment arm changes with joint angle only where a strength curve says so.
 *
 * Totals per joint motion come from dynamometry: hip, knee and ankle and their strength curves from Anderson,
 * Madigan & Nussbaum (2007) and Harbo et al. (2012), scaled by the 1.3 to 1.6 that resistance-trained men show over
 * untrained ones (Maden-Wilkinson et al., 2020); hip extension against hip angle from Németh et al. (1983); the
 * trunk from McNeill et al. (1980) and Graves et al. (1990); the neck from Vasavada et al. (2001); the shoulder
 * girdle from Garner & Shim (2008); the arm from Holzbaur et al. (2007), Delp et al. (1996) and O'Sullivan &
 * Gallwey (2002). The upper body is set above those untrained norms where they could not perform a trained lifter's
 * bench press, pull-up or curl. Each total is shared among the groups by peak force times moment arm in Rajagopal
 * et al. (2016) and Saul et al. (2015), with the hip extensors' moment arms against hip angle from Németh & Ohlsén
 * (1985): gluteus maximus loses leverage as the hip flexes while adductor magnus gains it.
 */
export function createActuators(): Actuator[] {
  const actuators: Actuator[] = [];
  for (const side of SIDES) {
    const s = sideSign(side);
    const add = (muscle: Muscle | null, entries: [string, number, ((angles: Angles) => number)?][]) =>
      actuators.push({
        muscle,
        side,
        entries: entries.map(([dof, capacity, scale]) => ({ dof, capacity, scale })),
      });
    const j = (joint: string, motion: string) => `${joint}_${side}.${motion}`;
    const kneeExtension = curve(j("knee", "flex"), [[0, 0.4], [30, 0.72], [65, 1], [90, 0.87], [120, 0.75], [150, 0.6]]);
    const kneeFlexion = curve(j("knee", "flex"), [[0, 0.9], [30, 1], [90, 0.61], [150, 0.4]]);
    const hipFlexion = curve(j("hip", "flex"), [[0, 1], [45, 0.8], [90, 0.55], [125, 0.4]]);
    const plantarflexion = curve(j("ankle", "dorsi"), [[-45, 0.3], [-20, 0.6], [0, 0.85], [20, 1], [35, 0.95]]);
    const elbowFlexion = curve(j("elbow", "flex"), [[0, 0.55], [40, 0.8], [90, 1], [130, 0.75], [150, 0.6]]);
    const elbowExtension = curve(j("elbow", "flex"), [[0, 0.7], [40, 0.9], [80, 1], [120, 0.85], [150, 0.7]]);
    // Shoulder strength against how far the arm is raised from hanging, whichever way it is raised. Measured
    // strength where there is any (Bober et al., 2002, for pulling a raised arm down and lifting it forward;
    // Kuhlman et al., 1992, for lifting it sideways), and the shape of each muscle's moment arm otherwise (Ackland
    // et al., 2008). Nothing is measured above 120°, so the curves keep falling there at the rate they arrive with.
    const raised = (points: [number, number][]) => curve(j("shoulder", "elev"), points);
    const pullDown = raised([[0, 0.6], [30, 0.85], [60, 1], [90, 1], [120, 0.9], [150, 0.65], [180, 0.5]]);
    const pullIn = raised([[0, 0.4], [30, 0.7], [60, 0.95], [90, 1], [120, 0.6], [150, 0.45], [180, 0.3]]);
    // Pulling the arm back past the body, the big extensors run out of leverage: a straight arm 45° behind the
    // trunk has under half the extension strength it has at the side (Bober et al., 2002).
    const behindBody = (a: Angles) => {
      const behind = deg(armBehind(a, side));
      return behind <= 0 ? 1 : Math.max(0.25, 1 - behind / 80);
    };
    const lats = (scale: (a: Angles) => number) => (a: Angles) => scale(a) * behindBody(a);

    // A group gets one actuator per head or per motion it produces, and its activation is the highest of them. The
    // two-joint heads stay tied across their joints, because that is what makes a lift favour one muscle over
    // another: hamstrings that extend the hip also flex the knee, which the quads then have to overcome.
    add("quads", [[j("knee", "flex"), -275, kneeExtension]]);
    add("quads", [
      [j("knee", "flex"), -65, kneeExtension],
      [j("hip", "flex"), 50, hipFlexion],
    ]);
    add("hamstrings", [
      [j("hip", "flex"), -125, curve(j("hip", "flex"), [[0, 0.6], [45, 1], [90, 0.96], [125, 0.84]])],
      [j("knee", "flex"), 130, kneeFlexion],
    ]);
    add("glutes", [[j("hip", "flex"), -100]]);
    add("glutes", [[j("hip", "rot"), 50]]);
    // The six small muscles under the glutes that turn the thigh outward, which the app has no group for. Without
    // them the glutes alone hold the knees out in a squat.
    add(null, [[j("hip", "rot"), 30]]);
    add("adductors", [[j("hip", "flex"), -100, curve(j("hip", "flex"), [[0, 0.13], [30, 0.5], [75, 1]])]]);
    add("adductors", [[j("hip", "abd"), -130]]);
    add("abductors", [[j("hip", "abd"), 120]]);
    add("abductors", [[j("hip", "rot"), -50]]);
    add("hip_flexors", [[j("hip", "flex"), 150, hipFlexion]]);
    add("calves", [[j("ankle", "dorsi"), -138, plantarflexion]]);
    add("calves", [
      [j("ankle", "dorsi"), -92, plantarflexion],
      [j("knee", "flex"), 28, kneeFlexion],
    ]);
    add("tibs", [[j("ankle", "dorsi"), 50, curve(j("ankle", "dorsi"), [[-45, 0.65], [-11, 1], [10, 0.86], [35, 0.4]])]]);

    // Each spinal level gets its own actuator: one spanning both would have to co-contract against the abs
    // whenever the two levels need torque in a different ratio than its fixed moment arms give.
    add("lower_back", [
      ["lumbar.flex", -220],
      ["lumbar.bend", s * 60],
    ]);
    add("lower_back", [
      ["thoracic.flex", -160],
      ["thoracic.bend", s * 45],
    ]);
    // The abdominal wall is one sheet from ribs to pelvis, so it flexes the spine as strongly at the base of the
    // ribcage as at the pelvis. Trunk flexion gets the same trained-over-untrained scaling as the legs.
    add("abs", [["lumbar.flex", 85]]);
    add("abs", [["thoracic.flex", 85]]);
    add("obliques", [
      ["lumbar.flex", 45],
      ["lumbar.bend", s * 80],
    ]);
    add("obliques", [
      ["thoracic.flex", 45],
      ["thoracic.bend", s * 55],
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
      ["neck.bend", s * 12],
    ]);
    add("neck", [
      ["neck.flex", -30],
      ["neck.bend", s * 12],
    ]);
    add("neck", [["neck.twist", s * 15]]);

    add("upper_traps", [[j("clavicle", "elev"), 130]]);
    add("upper_traps", [
      ["neck.flex", -10],
      ["neck.bend", s * 10],
    ]);
    add("serratus", [[j("clavicle", "prot"), 125]]);
    add("upper_back", [[j("clavicle", "prot"), -90]]);
    add("upper_back", [[j("clavicle", "elev"), -40]]);
    add("upper_back", [[j("shoulder", "hadd"), -30]]);
    // The pecs run from the breastbone straight to the upper arm, past the shoulder blade, so drawing the arm across
    // the chest also draws the whole shoulder forward, and serratus doesn't hold a press's protraction alone.
    add("chest", [
      [j("shoulder", "hadd"), 90],
      [j("clavicle", "prot"), 60],
    ]);
    // The pecs swing a raised arm forward across the chest far more strongly than they lift a hanging one.
    add("chest", [
      [
        j("shoulder", "flex"),
        80,
        (a) => {
          const lifted = Math.sin(a[j("shoulder", "elev")]);
          return 0.12 + 0.25 * lifted + 0.63 * lifted * Math.abs(Math.cos(a[j("shoulder", "plane")]));
        },
      ],
    ]);
    add("chest", [
      [j("shoulder", "abd"), -65, raised([[0, 0.75], [30, 0.95], [60, 1], [90, 0.8], [120, 0.5], [150, 0.3], [180, 0.15]])],
    ]);
    // Turning the upper arm about its own length. Inward, subscapularis does about half and the pecs, the lats
    // with teres major, and the front delts share the rest; outward it is infraspinatus, teres minor and the rear
    // delts, which the app shows together. The totals (65 N·m in, 42 out) and the shares are estimates from each
    // muscle's size and leverage, not read from a study. The app has no group for subscapularis.
    add(null, [[j("shoulder", "irot"), 30]]);
    add("chest", [[j("shoulder", "irot"), 15]]);
    add("lats", [[j("shoulder", "irot"), 15]]);
    add("front_delts", [[j("shoulder", "irot"), 5]]);
    add("rear_delts", [[j("shoulder", "irot"), -42]]);
    add("lats", [[j("shoulder", "flex"), -110, lats(pullDown)]]);
    add("lats", [[j("shoulder", "abd"), -110, lats(pullIn)]]);
    add("lats", [[j("clavicle", "elev"), -50]]);
    // Sized so that, with the pecs, a level arm lifts forward a fifth harder than the 77 N·m untrained men
    // measure there (Aronis et al., 2026), and falling off overhead at the rate they measured.
    add("front_delts", [
      [j("shoulder", "flex"), 75, raised([[0, 0.9], [30, 0.85], [60, 0.8], [90, 0.75], [120, 0.62], [150, 0.5], [180, 0.4]])],
    ]);
    add("front_delts", [[j("shoulder", "hadd"), 30]]);
    add("front_delts", [
      [j("shoulder", "abd"), 25, raised([[0, 0.15], [30, 0.35], [60, 0.65], [90, 0.85], [120, 1], [150, 1], [180, 0.8]])],
    ]);
    // The side delts stand in for the whole abducting group here. The deltoid alone has little leverage on a
    // hanging arm, where supraspinatus does most of the lifting, and the app has no group for the rotator cuff.
    add("side_delts", [
      [j("shoulder", "abd"), 65, raised([[0, 0.7], [30, 0.95], [60, 1], [90, 0.95], [120, 0.85], [150, 0.7], [180, 0.55]])],
    ]);
    add("rear_delts", [[j("shoulder", "hadd"), -45]]);
    add("rear_delts", [
      [j("shoulder", "flex"), -30, raised([[0, 0.95], [30, 1], [60, 0.92], [90, 0.7], [120, 0.5], [150, 0.35], [180, 0.2]])],
    ]);
    // The long heads cross the shoulder with little leverage on a hanging arm: stimulated alone, the triceps'
    // extends the shoulder a sixth as hard there as with the arm raised level, and the biceps' stops lifting the
    // arm by 60° (Landin & Thompson, 2011; Landin et al., 2017).
    add("biceps", [
      [j("elbow", "flex"), 70, elbowFlexion],
      [j("shoulder", "flex"), 10, raised([[0, 1], [30, 0.35], [60, 0.05], [90, 0]])],
    ]);
    add("triceps", [[j("elbow", "flex"), -65, elbowExtension]]);
    add("triceps", [
      [j("elbow", "flex"), -20, elbowExtension],
      [j("shoulder", "flex"), -15, raised([[0, 0.16], [40, 0.53], [80, 0.83], [120, 0.98], [150, 0.8], [180, 0.7]])],
    ]);
    add("forearms", [[j("elbow", "flex"), 18, elbowFlexion]]);
    add("forearms", [[j("wrist", "flex"), 24]]);
    add("forearms", [[j("wrist", "flex"), -14]]);
    add("forearms", [[j("wrist", "dev"), 11]]);
    add("forearms", [[j("wrist", "dev"), -11]]);
    add("forearms", [[j("forearm", "pron"), 12]]);
    add("forearms", [[j("forearm", "pron"), -14]]);
    // What a trained hand holds on a bar, which is more than it squeezes on a dynamometer (about 540 N): men
    // deadlift 160 kg without straps before the grip gives (Jukic et al., 2020).
    add("forearms", [[`grip_${side}`, 800]]);
  }
  return actuators;
}

/**
 * The joint speed, in rad/s, at which a shortening muscle's torque reaches zero. Twice what dynamometry on untrained
 * people gives: a trained lifter moves two thirds of a maximum squat at joint speeds where that curve leaves under
 * half the torque.
 */
const MAX_SPEED = 40;
/**
 * How much more than its isometric force an active muscle carries while it is stretched, per unit of activation:
 * the plateau of the lengthening side of the force-velocity curve in OpenSim's Thelen (2003) muscle. A maximal
 * voluntary lowering reaches less than this because the nervous system holds back, but a submaximal one needs that
 * much less activation, which is why measured activity while lowering runs at half to four fifths of the lift.
 */
const LENGTHENING_GAIN = 0.4;
/** How many times faster force rises with lengthening speed than it falls with shortening speed (Katz, 1939). */
const LENGTHENING_SLOPE = 6;

/**
 * The fraction of its isometric torque a muscle has at a joint speed in rad/s, positive when it shortens. Hill's
 * hyperbola with the curvature that fits Anderson, Madigan & Nussbaum's (2007) hip, knee and ankle data (half the
 * torque at a speed about 2.6 times the one that leaves three quarters), and a lengthening side that rises steeply
 * and levels off above isometric.
 */
export function speedFactor(speed: number) {
  const u = clamp(speed / MAX_SPEED, -0.6, 0.6);
  if (u >= 0) return (1 - u) / (1 + 4 * u);
  const k = ((5 * LENGTHENING_SLOPE) / LENGTHENING_GAIN) * -u;
  return 1 + (LENGTHENING_GAIN * k) / (1 + k);
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
  // Extension stretches the flexors up to the wrist's 85° limit (a hand flat under a push-up); flexion ends at 70°.
  forearms: {
    length: (a, side) => {
      const flex = a[`wrist_${side}.flex`];
      return 0.015 * (flex >= 0 ? flex : (-flex * 70) / 85);
    },
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
