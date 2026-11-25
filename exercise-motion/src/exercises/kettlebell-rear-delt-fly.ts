import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": -0.06,
  "root.pitch": 68,
  "hip.flex": 84,
  "hip.abd": 8,
  "knee.flex": 24,
  "ankle.dorsi": 8,
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
};

const HANG = {
  "shoulder.elev": 52,
  "shoulder.plane": 78,
  "shoulder.twist": 4,
  "elbow.flex": 10,
  "forearm.pron": 8,
  "wrist.flex": 0,
  "clavicle.elev": 4,
  "clavicle.prot": 4,
};

const OUT = {
  "shoulder.elev": 96,
  "shoulder.plane": 4,
  "shoulder.twist": 12,
  "elbow.flex": 22,
  "forearm.pron": 72,
  "wrist.flex": 2,
  "clavicle.elev": 12,
  "clavicle.prot": -14,
};

export const spec = buildExerciseSpec({
  id: "kettlebell-rear-delt-fly",
  catalogId: "3315c6f170d880af840afa6c72b76754",
  name: "Kettlebell Rear Delt Fly",
  defaultLoadKg: 6,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Sweep", "Shoulder height", "Lower", "Hang"],
  tempo: { lower: 1.5, bottom: 0.25, raise: 1.4, top: 0.3 },
  station: { kind: "standing", stanceX: 0.15, toeOutDeg: 6, torsoLeanDeg: 66 },
  apparatus: { kind: "kettlebells", sides: ["L", "R"], hangVertical: true },
  stiffness: { elbow: 3, shoulder: 0.65, lumbar: 10, forearm: 2 },
  hints: {
    start: { ...HINGE, ...HANG },
    end: { ...HINGE, ...OUT },
  },
  checks: () => [
    checkFlatBack("Keep the hinged torso still. Do not move the lower back or the legs to lift the bells."),
    checkNeutralNeck("Keep the back flat and the neck quiet through the hinge."),
    checkJointWithinAt(
      "palms-in",
      "Palms start facing each other",
      "Hang the kettlebells under the shoulders with the palms facing in.",
      "forearm_L.pron",
      "start",
      -20,
      35,
    ),
    checkJointWithinAt(
      "elbows-soft",
      "Elbows bend only slightly",
      "Let the elbows bend slightly. Do not turn the raise into a row.",
      "elbow_L.flex",
      "peak",
      6,
      40,
    ),
    checkJointRange(
      "arc",
      "Bells arc out to shoulder height",
      "Sweep the arms out until the elbows are near shoulder height, then lower them under control.",
      "shoulder_L.elev",
      28,
    ),
  ],
});
