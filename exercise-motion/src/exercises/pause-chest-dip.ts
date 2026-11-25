import { anchorPoint } from "../body";
import { buildExerciseSpec } from "../builders";
import { everyFrame } from "../checks";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Chest dip held at the bottom: torso leaned near 34° from vertical, elbows flared. */
const TRUNK = {
  "root.z": -0.04,
  "root.pitch": 25,
  "hip.flex": 30,
  "hip.abd": 8,
  "hip.rot": 2,
  "knee.flex": 96,
  "ankle.dorsi": -10,
  "lumbar.flex": 6,
  "thoracic.flex": 4,
  "neck.flex": 18,
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
  { anchor: "press_L", bodyweightShare: 0.462, share: 0.462, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "press_R", bodyweightShare: 0.462, share: 0.462, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "pause-chest-dip",
  catalogId: "26c5c6f170d8801f872af3c4774900c5",
  name: "Pause Chest Dip",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Pause", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 1.5, raise: 1.4, top: 0.35 },
  stiffness: { elbow: 5, shoulder: 1.4, hip: 2.2 },
  station: { kind: "dip", barY: 1.32, spacing: 0.6 },
  apparatus: { kind: "none", bodyweightLoads: LOADS },
  hints: {
    start: {
      ...TRUNK,
      "root.y": 1.36,
      "shoulder.elev": 30,
      "shoulder.plane": 68,
      "shoulder.twist": 4,
      "elbow.flex": 6,
    },
    end: {
      ...TRUNK,
      "root.y": 1.04,
      "shoulder.elev": 76,
      "shoulder.plane": -8,
      "shoulder.twist": 8,
      "elbow.flex": 100,
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
      "paused-bottom",
      "Paused deep at the bottom",
      "Once you have finished lowering to your end range, pause in that bottom position as you remain completely stationary for a brief period of time.",
      "elbow_L.flex",
      "bottom",
      85,
      125,
    ),
    checkJointRange(
      "elbow-rom",
      "Elbows extend after the pause",
      "Reverse the movement by pushing through the bars to lift yourself up until you have fully straightened your elbows.",
      "elbow_L.flex",
      70,
    ),
    {
      id: "forward-lean",
      label: "Torso leans forward near 34°",
      cue: "Lean your torso and head moderately forward. Leaning forward near 30 degrees from vertical is generally appropriate.",
      evaluate: ({ body, frames }) => {
        const leans = frames.map((frame) => leanFromVertical(body, frame));
        const lo = Math.min(...leans);
        const hi = Math.max(...leans);
        return {
          pass: lo >= 28 && hi <= 40,
          measured: `torso lean stays ${lo.toFixed(0)}°–${hi.toFixed(0)}° from vertical`,
        };
      },
    },
    {
      id: "pause-hold",
      label: "Bottom pause lasts about 1.5 seconds",
      cue: "Pause in that bottom position as you remain completely stationary for a brief period of time (approximately two seconds).",
      evaluate: ({ sequence }) => {
        const pause = sequence.phases.find((phase) => phase.name === "bottom");
        const seconds = pause ? (pause.to - pause.from) / sequence.fps : 0;
        return { pass: seconds >= 1.4 && seconds <= 2.1, measured: `bottom hold is ${seconds.toFixed(1)} s` };
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
