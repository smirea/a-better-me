import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { lockAngle } from "../solver";

/** Overhand grip with the bar behind the thighs. Elevation stays modest so the bar clears the hips. */
const ARMS = {
  "shoulder.plane": -18,
  "shoulder.twist": -4,
  "elbow.flex": 10,
  "forearm.pron": 70,
  "wrist.flex": 2,
  "clavicle.prot": -2,
};

export const spec = buildExerciseSpec({
  id: "barbell-behind-the-back-shrug",
  catalogId: "1a15c6f170d8804687dfef42a3ca8dd6",
  name: "Barbell Behind-The-Back Shrug",
  defaultLoadKg: 30,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Shrug", "Ears", "Lower", "Depressed"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.2, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.26,
  },
  extraContacts: { bar: { thigh_L: 0.05, thigh_R: 0.05, pelvis: 0.04 } },
  stiffness: { elbow: 6, knee: 4, hip: 3, lumbar: 8, clavicle: 1.1, shoulder: 1.4 },
  progress: (body, frame) => anchorPoint(body, frame, "grip_L").y,
  extraGoals: (body) => [
    lockAngle(body, "shoulder_L.plane", -22, 8),
    lockAngle(body, "shoulder_R.plane", -22, 8),
    ({ frame, push }) => {
      const grip = anchorPoint(body, frame, "grip_L");
      const pelvis = anchorPoint(body, frame, "pelvisBottom");
      push(48 * (grip.z - (pelvis.z - 0.14)));
    },
  ],
  hints: {
    start: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 16, "clavicle.elev": -6 },
    end: { ...POSTURE_HINTS.standing, ...ARMS, "shoulder.elev": 18, "clavicle.elev": 22 },
  },
  checks: () => [
    checkFlatBack(
      "Stand upright with the bar behind the thighs and the lower back near neutral.",
    ),
    checkNeutralNeck("Keep the neck neutral and look straight ahead while the bar stays behind you."),
    checkJointWithinAt(
      "elbows-straight",
      "Elbows stay extended",
      "Shrug upward with the elbows extended. If the hips block the bar, use a shorter range.",
      "elbow_L.flex",
      "peak",
      0,
      22,
    ),
    checkJointWithinAt(
      "arms-behind",
      "Arms stay behind the torso",
      "Grasp the bar behind the body with a shoulder-width overhand grip, palms facing backward.",
      "shoulder_L.plane",
      "peak",
      -40,
      -6,
    ),
    checkJointRange(
      "scapular-elevation",
      "Shoulder girdle elevates",
      "Shrug the shoulders up through the range the bar can travel behind the hips, then lower under control.",
      "clavicle_L.elev",
      16,
    ),
  ],
});
