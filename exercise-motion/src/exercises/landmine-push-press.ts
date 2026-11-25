import { anchorPoint } from "../body";
import { buildExerciseSpec, POSTURE_HINTS, sidedHints } from "../builders";
import { deg } from "../math";
import { checkJointRange, checkJointWithinAt } from "../postures";

/** Single-arm landmine push press: dip, then drive the bar end overhead with the legs. */
const STAND = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.943,
  "root.pitch": 4,
  "lumbar.flex": -3,
  "knee.flex": 6,
  "hip.flex": 4,
  "ankle.dorsi": 2,
  "neck.flex": 0,
};

const DIP = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.84,
  "root.pitch": 10,
  "lumbar.flex": -2,
  "hip.flex": 38,
  "knee.flex": 48,
  "ankle.dorsi": 18,
  "neck.flex": 2,
};

const ARM_RACK = {
  "clavicle.elev": 6,
  "clavicle.prot": -2,
  "shoulder.elev": 52,
  "shoulder.plane": 84,
  "shoulder.twist": 8,
  "elbow.flex": 100,
  "forearm.pron": 12,
  "wrist.flex": 0,
};

const ARM_LOCK = {
  "clavicle.elev": 20,
  "clavicle.prot": -2,
  "shoulder.elev": 132,
  "shoulder.plane": 76,
  "shoulder.twist": 0,
  "elbow.flex": 10,
  "forearm.pron": 10,
  "wrist.flex": 0,
};

const REST = {
  "clavicle.elev": 2,
  "shoulder.elev": 16,
  "shoulder.plane": 30,
  "elbow.flex": 16,
  "forearm.pron": 30,
  "wrist.flex": 0,
};

export const spec = buildExerciseSpec({
  id: "landmine-push-press",
  catalogId: "3b15c6f170d8802b8a59ee2a179b4840",
  name: "Landmine Push Press",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "asymmetrical",
  activeSide: "L",
  grip: "press",
  phaseLabels: ["Dip", "Drive", "Lower", "Rack"],
  station: { kind: "standing", stanceX: 0.16 },
  apparatus: { kind: "landmine", pivotZ: 1.65, sides: ["L"] },
  hints: {
    start: sidedHints("L", ARM_RACK, REST, STAND),
    end: sidedHints("L", ARM_LOCK, REST, STAND),
  },
  waypoints: [
    { hints: sidedHints("L", ARM_RACK, REST, STAND), duration: 0.8, hold: 0.15 },
    { hints: sidedHints("L", ARM_RACK, REST, DIP), duration: 0.55, hold: 0.08 },
    { hints: sidedHints("L", ARM_LOCK, REST, STAND), duration: 0.7, hold: 0.22 },
  ],
  loopMode: "cycle",
  stiffness: { elbow: 2.2, shoulder: 1.6, knee: 1.4, hip: 1.4 },
  extraGoals: (body) => [
    ({ frame, push }) => {
      const p = anchorPoint(body, frame, "grip_L");
      const dist = Math.hypot(p.x, p.y - 0.06, p.z - 1.65);
      push(16 * (dist - 2.02));
    },
  ],
  checks: () => [
    checkJointRange("knee-dip", "Dip before the drive", "Bend the knees in a short dip, then extend them as the bar leaves the shoulder.", "knee_L.flex", 25),
    checkJointRange("elbow-drive", "Arm finishes the press", "After the leg drive, straighten the pressing elbow overhead.", "elbow_L.flex", 55),
    checkJointWithinAt("dip-knee", "Knees bend in the dip", "The dip is a quarter squat, not a full squat.", "knee_L.flex", "peak", 30, 70),
    {
      id: "lockout-elbow",
      label: "Elbow extends at the top",
      cue: "Finish with the pressing elbow nearly straight.",
      evaluate: ({ angles }) => {
        let min = Infinity;
        for (const a of angles) min = Math.min(min, deg(a["elbow_L.flex"]));
        return { pass: min <= 24, measured: `pressing elbow reaches ${min.toFixed(0)}° of flexion` };
      },
    },
    {
      id: "shoulder-up",
      label: "Shoulder flexes up the arc",
      cue: "The pressing shoulder finishes flexed, with the bar end up the landmine arc.",
      evaluate: ({ angles }) => {
        let max = -Infinity;
        for (const a of angles) max = Math.max(max, deg(a["shoulder_L.elev"]));
        return { pass: max >= 105, measured: `pressing shoulder reaches ${max.toFixed(0)}° of elevation` };
      },
    },
  ],
});
