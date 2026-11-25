import { Vector3 } from "three";
import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

/** Standing hinged T-bar, no chest pad. Pivot behind the lifter, sleeve in front. */
const PIVOT_Z = -1.5;

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": 0.04,
  "root.pitch": 52,
  "hip.flex": 70,
  "hip.abd": 10,
  "knee.flex": 28,
  "ankle.dorsi": 10,
  "lumbar.flex": 6,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "bent-over-neutral-grip-t-bar-row",
  catalogId: "1a15c6f170d88004a245f5a0ea564b67",
  name: "Bent-Over Neutral Grip T-Bar Row",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Hinge", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, heelZ: -0.02, toeOutDeg: 8, torsoLeanDeg: 52 },
  apparatus: { kind: "landmine", pivotZ: PIVOT_Z, sides: ["L", "R"] },
  stiffness: { lumbar: 14, thoracic: 10, hip: 8, knee: 5 },
  extraContacts: {
    bar: { thigh_L: 0.06, thigh_R: 0.06, shank_L: 0.05, shank_R: 0.05, pelvis: 0.05 },
  },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const pivot = new Vector3(0, 0.06, PIVOT_Z);
      const left = anchorPoint(body, frame, "grip_L");
      const right = anchorPoint(body, frame, "grip_R");
      const mid = left.clone().add(right).multiplyScalar(0.5);
      push(16 * (mid.distanceTo(pivot) - 1.9));
      push(40 * (left.x - 0.02));
      push(40 * (right.x + 0.02));
      push(14 * (left.y - right.y));
    },
  ],
  hints: {
    start: {
      ...HINGE,
      "shoulder.twist": 0,
      "forearm.pron": 0,
      "wrist.flex": 6,
      "shoulder.elev": 50,
      "shoulder.plane": 72,
      "elbow.flex": 10,
      "clavicle.prot": 4,
      "clavicle.elev": 6,
    },
    end: {
      ...HINGE,
      "shoulder.twist": 0,
      "forearm.pron": 0,
      "wrist.flex": 6,
      "shoulder.elev": 36,
      "shoulder.plane": 56,
      "elbow.flex": 108,
      "clavicle.prot": -14,
      "clavicle.elev": 8,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your torso in a fixed hinged position as you maintain the same angle of bend in your hips and knees throughout your set while keeping your core braced and your lower back near a neutral position.",
    ),
    checkNeutralNeck("Keep your lower back flat and chest up rather than rounding your back."),
    checkJointRange(
      "row",
      "Elbows drive up and back",
      "Pull the bar upward and back toward your torso by driving your elbows simultaneously upward and backward while progressively bending your elbows.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "arms-long",
      "Elbows start straight",
      "Lift the bar just high enough that you can experience resistance from the weight when your elbows are fully straight.",
      "elbow_L.flex",
      "start",
      0,
      32,
    ),
    checkJointWithinAt(
      "grip",
      "Grip",
      "Firmly grasp the parallel handles with a neutral grip so your palms face each other.",
      "forearm_L.pron",
      "start",
      -25,
      28,
    ),
    checkJointWithinAt(
      "elbow-path",
      "Elbow path",
      "Keep them tucked fairly close to your sides with this neutral grip rather than notably flaring your elbows away from your sides.",
      "shoulder_L.plane",
      "peak",
      35,
      78,
    ),
    checkJointWithinAt(
      "scapulae",
      "Shoulder blades pinch",
      "Squeeze your shoulder blades together at the top of the pull as if you were trying to pinch a pencil with your shoulder blades.",
      "clavicle_L.prot",
      "peak",
      -30,
      -2,
    ),
  ],
});
