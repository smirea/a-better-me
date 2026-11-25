import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkFeetPlanted, checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

const TRUNK = {
  ...POSTURE_HINTS.standing,
  "root.pitch": 2,
  "lumbar.flex": -4,
  "thoracic.flex": -2,
  "neck.flex": 2,
  "clavicle.elev": 10,
  "clavicle.prot": -4,
  "forearm.pron": 55,
  "wrist.flex": -4,
  "knee.flex": 4,
};

/** Wide grip, elbows flared, bar on the upper chest. */
const FRONT = {
  ...TRUNK,
  "shoulder.elev": 52,
  "shoulder.plane": 42,
  "shoulder.twist": 18,
  "elbow.flex": 92,
  "clavicle.elev": 8,
};

/** Bar clears the crown without locking the elbows out. */
const CLEAR = {
  ...TRUNK,
  "shoulder.elev": 128,
  "shoulder.plane": 18,
  "shoulder.twist": 4,
  "elbow.flex": 42,
  "clavicle.elev": 18,
  "neck.flex": 6,
};

/** Bar lowers behind the head toward the upper traps. Elbows stay under the bar. */
const BEHIND = {
  ...TRUNK,
  "shoulder.elev": 124,
  "shoulder.plane": -28,
  "shoulder.twist": -10,
  "elbow.flex": 58,
  "clavicle.elev": 14,
  "neck.flex": 14,
};

export const spec = buildExerciseSpec({
  id: "bradford-press",
  catalogId: "1a05c6f170d88045aa23e20a3b1a6bc4",
  name: "Bradford Press",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "press",
  phaseLabels: ["Clear", "Behind", "Return", "Front"],
  station: { kind: "standing", stanceX: 0.17, rack: { hookY: 1.38, safetyY: 0.9 } },
  apparatus: { kind: "barbell", style: "straight", gripX: 0.4, anchor: "press" },
  hints: { start: FRONT, end: BEHIND },
  waypoints: [
    { hints: FRONT, duration: 0.9, hold: 0.15 },
    { hints: CLEAR, duration: 0.7, hold: 0.05 },
    { hints: BEHIND, duration: 0.7, hold: 0.2 },
    { hints: CLEAR, duration: 0.7, hold: 0.05 },
  ],
  loopMode: "cycle",
  stiffness: { elbow: 1.2, shoulder: 0.45, lumbar: 7, knee: 4 },
  checks: () => [
    checkFlatBack("Keep the torso upright. Do not lean back as the bar travels around the head."),
    checkFeetPlanted("Squeeze the glutes and quads and keep the feet planted."),
    checkJointRange("shoulder-travel", "Bar travels front to behind", "Press just in front of the face, then drive the elbows back to lower the bar behind the head.", "shoulder_L.plane", 45),
    checkJointWithinAt("front-rack", "Starts at the upper chest", "Begin with the bar at the upper chest and the elbows flared under a wide grip.", "elbow_L.flex", "start", 70, 115),
    {
      id: "behind-neck",
      label: "Bar reaches behind the neck",
      cue: "Lower behind the head only as far as the shoulders allow, elbows stacked under the bar.",
      evaluate: ({ angles }) => {
        let min = Infinity;
        for (const a of angles) min = Math.min(min, deg(a["shoulder_L.plane"]));
        return { pass: min <= -8, measured: `shoulder plane reaches ${min.toFixed(0)}° (behind is negative)` };
      },
    },
    {
      id: "no-full-lockout",
      label: "Elbows stay softly bent",
      cue: "Do not lock the elbows out. Arc the bar over the head.",
      evaluate: ({ angles }) => {
        let min = Infinity;
        for (const a of angles) min = Math.min(min, deg(a["elbow_L.flex"]));
        return { pass: min >= 28, measured: `elbow flexion stays at least ${min.toFixed(0)}°` };
      },
    },
  ],
});
