import { anchorPoint } from "../body";
import { buildExerciseSpec } from "../builders";
import { everyFrame } from "../checks";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Mild forward lean, proud chest, knees bent so the feet clear the floor. */
const TRUNK = {
  "root.z": 0.02,
  "root.pitch": 14,
  "hip.flex": 18,
  "hip.abd": 6,
  "hip.rot": 4,
  "knee.flex": 90,
  "ankle.dorsi": -12,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 12,
  "clavicle.prot": -8,
  "clavicle.elev": -4,
  "forearm.pron": 2,
  "wrist.flex": 2,
};

function leanFromVertical(body: Parameters<typeof anchorPoint>[0], frame: Parameters<typeof anchorPoint>[1]) {
  const chest = anchorPoint(body, frame, "sternum");
  const hip = anchorPoint(body, frame, "pelvisFront");
  return (Math.atan2(chest.z - hip.z, chest.y - hip.y) * 180) / Math.PI;
}

const LOADS = [
  { anchor: "press_L", bodyweightShare: 0.5, share: 0.5, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "press_R", bodyweightShare: 0.5, share: 0.5, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "dip",
  catalogId: "2945c6f170d880fd847ade9bb93afd91",
  name: "Dip",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  stiffness: { elbow: 5, shoulder: 1.4, hip: 2.4 },
  station: { kind: "dip", barY: 1.32, spacing: 0.56 },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...TRUNK,
      "root.y": 1.44,
      "shoulder.elev": 18,
      "shoulder.plane": 78,
      "shoulder.twist": 4,
      "elbow.flex": 5,
    },
    end: {
      ...TRUNK,
      "root.y": 1.06,
      "shoulder.elev": 78,
      "shoulder.plane": -46,
      "shoulder.twist": 10,
      "elbow.flex": 108,
      "clavicle.prot": -14,
    },
  },
  extraKeyGoals: (body) => ({
    start: [lockAngle(body, "elbow_L.flex", 6, 18), lockAngle(body, "elbow_R.flex", 6, 18)],
  }),
  checks: () => [
    checkJointWithinAt(
      "elbows-locked",
      "Elbows start straight",
      "Firmly grasp the bars with your palms facing each other and your elbows straight.",
      "elbow_L.flex",
      "top",
      0,
      22,
    ),
    checkJointWithinAt(
      "elbows-deep",
      "Elbows bend through a full dip",
      "Continue descending through the full range of motion that your shoulder mobility comfortably permits.",
      "elbow_L.flex",
      "bottom",
      85,
      130,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend to press up",
      "Reverse the movement by pushing through the bars to lift yourself up until you have fully straightened your elbows.",
      "elbow_L.flex",
      70,
    ),
    {
      id: "mild-forward-lean",
      label: "Mild forward torso lean",
      cue: "Rather than keeping your torso fully upright, mildly lean your torso forward and maintain this mild lean throughout your set.",
      evaluate: ({ body, frames }) => {
        const leans = frames.map((frame) => leanFromVertical(body, frame));
        const lo = Math.min(...leans);
        const hi = Math.max(...leans);
        return {
          pass: lo >= 8 && hi <= 26,
          measured: `torso lean stays ${lo.toFixed(0)}°–${hi.toFixed(0)}° from vertical`,
        };
      },
    },
    {
      id: "feet-clear",
      label: "Feet stay off the floor",
      cue: "While keeping your elbows straightened, lift your feet off the ground.",
      evaluate: (context) =>
        everyFrame(
          context,
          (frame) => (0.08 - anchorPoint(context.body, frame, "toe_L").y) * 100,
          0,
          " cm below a clear floor gap",
        ),
    },
  ],
});
