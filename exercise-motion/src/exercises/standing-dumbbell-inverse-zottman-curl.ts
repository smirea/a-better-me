import { buildExerciseSpec, holdElbowNearShoulder, POSTURE_HINTS } from "../builders";
import { deg } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt } from "../postures";

/**
 * Inverse Zottman: curl in a hammer grip, supinate at the top, lower underhand.
 * The concentric is the neutral (less supinated) half; the eccentric is supinated.
 */
const TRUNK = {
  ...POSTURE_HINTS.standing,
  "shoulder.elev": 14,
  "shoulder.plane": 46,
  "clavicle.elev": 2,
  "clavicle.prot": -2,
  "wrist.flex": 2,
};

const DOWN_NEUTRAL = {
  ...TRUNK,
  "shoulder.twist": 6,
  "forearm.pron": 0,
  "elbow.flex": 6,
};

const UP_NEUTRAL = {
  ...TRUNK,
  "shoulder.elev": 16,
  "shoulder.twist": 4,
  "forearm.pron": 0,
  "elbow.flex": 134,
};

const UP_SUPINATED = {
  ...TRUNK,
  "shoulder.elev": 16,
  "shoulder.twist": -16,
  "forearm.pron": -78,
  "elbow.flex": 134,
};

const DOWN_SUPINATED = {
  ...TRUNK,
  "shoulder.twist": -16,
  "forearm.pron": -78,
  "elbow.flex": 8,
};

export const spec = buildExerciseSpec({
  id: "standing-dumbbell-inverse-zottman-curl",
  catalogId: "2ab5c6f170d880829468c80cada5b976",
  name: "Standing Dumbbell Inverse Zottman Curl",
  defaultLoadKg: 8,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Curl", "Supinate", "Lower", "Reset"],
  loopMode: "cycle",
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 6 },
  apparatus: { kind: "dumbbells" },
  hints: { start: DOWN_NEUTRAL, end: UP_SUPINATED },
  waypoints: [
    { hints: DOWN_NEUTRAL, duration: 0.4, hold: 0.2 },
    { hints: UP_NEUTRAL, duration: 1.25, hold: 0.15 },
    { hints: UP_SUPINATED, duration: 0.85, hold: 0.2 },
    { hints: DOWN_SUPINATED, duration: 1.3, hold: 0.15 },
    { hints: DOWN_NEUTRAL, duration: 0.85, hold: 0.15 },
  ],
  extraGoals: (body) => [
    holdElbowNearShoulder(body, "L", [0.05, -0.3, 0.05], 16, "xz"),
    holdElbowNearShoulder(body, "R", [0.05, -0.3, 0.05], 16, "xz"),
  ],
  checks: () => [
    checkFlatBack(
      "Stand upright with your arms hanging by your sides and your elbows straight. Keep the torso upright.",
    ),
    checkJointRange(
      "elbow-rom",
      "Full elbow flexion curl",
      "Curl the dumbbells by bending your elbows until the forearms touch the biceps, then straighten the elbows on the way down.",
      "elbow_L.flex",
      100,
    ),
    checkJointWithinAt(
      "elbows-flexed",
      "Elbows fully flex at the peak",
      "At the top of the curl, your elbows should be fully bent with your forearms touching your biceps.",
      "elbow_L.flex",
      "bottom",
      110,
      150,
    ),
    {
      id: "neutral-on-the-way-up",
      label: "Hammer grip on the way up",
      cue: "Turn your palms in toward your sides and curl while keeping the palms facing in toward each other.",
      evaluate: ({ angles, top }) => {
        const pron = deg(angles[top]["forearm_L.pron"]);
        return {
          pass: pron > -24 && pron < 24,
          measured: `forearm starts at ${pron.toFixed(0)}° of pronation`,
        };
      },
    },
    {
      id: "supinated-on-the-way-down",
      label: "Underhand on the way down",
      cue: "Rotate the palms back toward the shoulders at the top, then lower without rotating out of that underhand grip.",
      evaluate: ({ angles }) => {
        let flexedPron = 90;
        for (const a of angles) {
          if (deg(a["elbow_L.flex"]) > 110) flexedPron = Math.min(flexedPron, deg(a["forearm_L.pron"]));
        }
        return {
          pass: flexedPron < -50,
          measured: `forearm reaches ${flexedPron.toFixed(0)}° while the elbow is flexed`,
        };
      },
    },
  ],
});
