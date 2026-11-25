import { anchorPoint } from "../body";
import { buildExerciseSpec } from "../builders";
import { everyFrame } from "../checks";
import { checkJointRange, checkJointWithinAt } from "../postures";
import { lockAngle } from "../solver";

/** Upright triceps dip held at the bottom, elbows tucked, lean near 10°. */
const TRUNK = {
  "root.z": 0.02,
  "root.pitch": 10,
  "hip.flex": 14,
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
  { anchor: "press_L", bodyweightShare: 0.462, share: 0.462, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
  { anchor: "press_R", bodyweightShare: 0.462, share: 0.462, grip: "press" as const, direction: [0, 1, 0] as [number, number, number] },
];

export const spec = buildExerciseSpec({
  id: "pause-triceps-dip",
  catalogId: "1a05c6f170d88094ba6ac1b79ded4cf9",
  name: "Pause Triceps Dip",
  defaultLoadKg: 0,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Lower", "Pause", "Press", "Lockout"],
  tempo: { lower: 1.8, bottom: 1.5, raise: 1.4, top: 0.35 },
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
      "clavicle.prot": -12,
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
      30,
    ),
    checkJointWithinAt(
      "paused-bottom",
      "Paused with the elbows bent at least 90°",
      "Once you have finished lowering to your end range, pause in that bottom position as you remain completely stationary.",
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
      65,
    ),
    {
      id: "upright-lean",
      label: "Torso stays mostly upright",
      cue: "Keep your torso mostly upright for this triceps dip rather than more prominently leaning your torso forward.",
      evaluate: ({ body, frames }) => {
        const leans = frames.map((frame) => leanFromVertical(body, frame));
        const lo = Math.min(...leans);
        const hi = Math.max(...leans);
        return {
          pass: lo >= 6 && hi <= 18,
          measured: `torso lean stays ${lo.toFixed(0)}°–${hi.toFixed(0)}° from vertical`,
        };
      },
    },
    {
      id: "pause-hold",
      label: "Bottom pause lasts about 1.5 seconds",
      cue: "Pause in that bottom position for a brief period of time (approximately two seconds).",
      evaluate: ({ sequence }) => {
        const pause = sequence.phases.find((phase) => phase.name === "bottom");
        const seconds = pause ? (pause.to - pause.from) / sequence.fps : 0;
        return { pass: seconds >= 1.4 && seconds <= 2.1, measured: `bottom hold is ${seconds.toFixed(1)} s` };
      },
    },
    {
      id: "feet-clear",
      label: "Feet stay off the floor",
      cue: "While keeping your elbows straightened and torso upright, lift your feet off the ground.",
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
