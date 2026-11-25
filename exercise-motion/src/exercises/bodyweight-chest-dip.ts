import { anchorPoint } from "../body";
import { buildExerciseSpec } from "../builders";
import { everyFrame } from "../checks";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Chest dip: torso leaned near 30° from vertical, elbows flared more than a triceps dip. */
const TRUNK = {
  "root.z": -0.02,
  "root.pitch": 26,
  "hip.flex": 28,
  "hip.abd": 8,
  "hip.rot": 2,
  "knee.flex": 92,
  "ankle.dorsi": -10,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 16,
  "clavicle.prot": -8,
  "clavicle.elev": -3,
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
  id: "bodyweight-chest-dip",
  catalogId: "26c5c6f170d8803385dbcb10335259f6",
  name: "Bodyweight Chest Dip",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 0.25, raise: 1.4, top: 0.4 },
  stiffness: { elbow: 5, shoulder: 1.4, hip: 2.2 },
  station: { kind: "dip", barY: 1.32, spacing: 0.56 },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...TRUNK,
      "root.y": 1.38,
      "shoulder.elev": 28,
      "shoulder.plane": 72,
      "shoulder.twist": 4,
      "elbow.flex": 6,
    },
    end: {
      ...TRUNK,
      "root.y": 1.08,
      "shoulder.elev": 74,
      "shoulder.plane": -15,
      "shoulder.twist": 8,
      "elbow.flex": 96,
      "clavicle.prot": -12,
    },
  },
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
    checkJointRange(
      "elbow-rom",
      "Elbows bend and extend",
      "Reverse the movement by pushing through the bars to lift yourself up until you have fully straightened your elbows.",
      "elbow_L.flex",
      70,
    ),
    {
      id: "forward-lean",
      label: "Moderate forward torso lean",
      cue: "Lean your torso and head moderately forward. Leaning forward near 30 degrees from vertical is generally appropriate.",
      evaluate: ({ body, frames }) => {
        const leans = frames.map((frame) => leanFromVertical(body, frame));
        const lo = Math.min(...leans);
        const hi = Math.max(...leans);
        return {
          pass: lo >= 24 && hi <= 42,
          measured: `torso lean stays ${lo.toFixed(0)}°–${hi.toFixed(0)}° (target 24°–42°)`,
        };
      },
    },
    {
      id: "elbow-flare",
      label: "Elbows flare under 45°",
      cue: "Aiming to flare your elbows less than 45 degrees is generally appropriate for most people.",
      evaluate: (context) =>
        everyFrame(context, (_, a) => {
          const plane = Math.abs((a["shoulder_L.plane"] * 180) / Math.PI);
          return plane > 70 ? plane - 70 : 0;
        }, 25, "° outside a flared elbow plane"),
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
