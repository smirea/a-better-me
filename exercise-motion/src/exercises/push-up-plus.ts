import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

const HANDS = {
  "root.z": 0,
  "shoulder.twist": 6,
  "forearm.pron": 75,
  "wrist.flex": -28,
  "hip.flex": 16,
  "hip.abd": 6,
  "knee.flex": 12,
  "ankle.dorsi": -8,
  "neck.flex": 8,
  "lumbar.flex": 2,
  "thoracic.flex": 2,
};

const LOADS = [
  { anchor: "palmFlat_L", bodyweightShare: 0.22, share: 0.22, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "palmFlat_R", bodyweightShare: 0.22, share: 0.22, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "push-up-plus",
  catalogId: "2335c6f170d8806ca3efcb9b8fa09e94",
  name: "Push-Up Plus",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "open",
  phaseLabels: ["Lower", "Chest", "Press", "Plus"],
  tempo: { lower: 1.5, bottom: 0.15, raise: 1.2, top: 0.4 },
  stiffness: { elbow: 70, shoulder: 6, clavicle: 1.2, hip: 8, knee: 10, ankle: 12 },
  extraGoals: (body) => [
    lockAngle(body, "ankle_L.dorsi", -8, 28),
    lockAngle(body, "ankle_R.dorsi", -8, 28),
    lockAngle(body, "knee_L.flex", 12, 20),
    lockAngle(body, "knee_R.flex", 12, 20),
  ],
  station: { kind: "pushup", handX: 0.34, handZ: 0.58, feetElevationY: 0.08, footX: 0.14, footZ: -0.82 },
  extraContacts: { "pushup.footBox": { foot_L: 0.07, foot_R: 0.07 } },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.6,
      "root.pitch": 70,
      "shoulder.elev": 82,
      "shoulder.plane": 74,
      "elbow.flex": 6,
      "clavicle.prot": 18,
      "clavicle.elev": 2,
      "thoracic.flex": 4,
    },
    end: {
      ...POSTURE_HINTS.pronePlank,
      ...HANDS,
      "root.y": 0.34,
      "root.pitch": 82,
      "shoulder.elev": 42,
      "shoulder.plane": 62,
      "elbow.flex": 105,
      "clavicle.prot": -10,
      "clavicle.elev": -2,
      "thoracic.flex": 0,
    },
  },
  checks: () => [
    checkJointWithinAt(
      "plus",
      "Shoulder blades protract at the top",
      "After the elbows straighten, keep pushing the ground away and spread the shoulder blades apart as far as you can.",
      "clavicle_L.prot",
      "top",
      10,
      26,
    ),
    checkJointWithinAt(
      "retracted-bottom",
      "Shoulder blades retract as the chest lowers",
      "Allow the shoulder blades to pull back together as you lower, finishing with a proud chest.",
      "clavicle_L.prot",
      "bottom",
      -36,
      2,
    ),
    checkJointRange(
      "scapular-plus",
      "Scapulae travel through the plus",
      "The plus is the extra shoulder-blade spread at the top of each push-up.",
      "clavicle_L.prot",
      18,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows bend and straighten",
      "Lower the chest to the ground by bending the elbows, then press back to straight elbows.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "elbows-locked",
      "Elbows lock out before the plus",
      "Finish straightening the elbows, then continue pushing the shoulder blades apart.",
      "elbow_L.flex",
      "top",
      0,
      20,
    ),
    checkFlatBack(
      "Tighten the abdominals and glutes so a line still runs from the legs through the hips to the torso.",
      16,
    ),
    {
      id: "hands-shoulder-width",
      label: "Hands sit mildly outside shoulder width",
      cue: "Situate your hands mildly outside shoulder width apart from each other.",
      evaluate: ({ body, frames }) => {
        const x = Math.abs(anchorPoint(body, frames[0], "palmFlat_L").x);
        return { pass: x >= 0.28 && x <= 0.42, measured: `hand is ${(x * 100).toFixed(0)} cm from midline` };
      },
    },
  ],
});
