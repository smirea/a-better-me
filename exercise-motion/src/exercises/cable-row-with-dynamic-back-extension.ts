import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { deg } from "../math";

/** Overhand row that rounds and then extends the whole back with the pull. */
const GRIP = {
  "shoulder.twist": 16,
  "forearm.pron": 75,
  "wrist.flex": 6,
};

const REACH = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 18,
  "hip.flex": 98,
  "knee.flex": 78,
  "lumbar.flex": 26,
  "thoracic.flex": 18,
  "neck.flex": 10,
  ...GRIP,
  "shoulder.elev": 78,
  "shoulder.plane": 70,
  "elbow.flex": 8,
  "clavicle.prot": 12,
  "clavicle.elev": 8,
};

const PULL = {
  ...POSTURE_HINTS.seated,
  "root.pitch": 4,
  "hip.flex": 86,
  "knee.flex": 70,
  "lumbar.flex": 4,
  "thoracic.flex": -4,
  "neck.flex": 0,
  ...GRIP,
  "shoulder.elev": 46,
  "shoulder.plane": 34,
  "elbow.flex": 110,
  "clavicle.prot": -16,
  "clavicle.elev": 6,
};

export const spec = buildExerciseSpec({
  id: "cable-row-with-dynamic-back-extension",
  catalogId: "2ad5c6f170d8800794e2f44d340d181e",
  name: "Cable Row With Dynamic Back Extension",
  defaultLoadKg: 16,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Pull", "Upright", "Round", "Reach"],
  tempo: { lower: 1.6, bottom: 0.3, raise: 1.8, top: 0.3 },
  station: {
    kind: "seated",
    seatZ: -0.02,
    heelZ: 0.42,
    frame: { type: "seated-row", pulleyY: 0.62 },
    feetMode: "floor",
  },
  stiffness: { lumbar: 7, thoracic: 6, hip: 1.2, elbow: 3 },
  apparatus: {
    kind: "cable-single",
    skipColumn: true,
    pulley: [0, 0.62, 1.25],
    facingDir: -1,
    attachment: "straight-bar",
    attachmentWidth: 0.7,
    gripX: 0.28,
  },
  hints: { start: REACH, end: PULL },
  checks: () => [
    checkNeutralNeck("Round through a comfortable range and keep your neck from cranking.", 28),
    checkJointRange(
      "elbow-row",
      "Elbows bend as the back extends",
      "Pull the bar back toward your torso by driving your elbows backward while you straighten your back.",
      "elbow_L.flex",
      70,
    ),
    checkJointRange(
      "trunk-extends",
      "Back extends from a rounded reach",
      "Row the bar toward you in sync with straightening your back, and round it again as the bar returns.",
      "lumbar.flex",
      16,
    ),
    checkJointWithinAt(
      "rounded-start",
      "Back starts rounded with arms long",
      "Reach forward and round your lower, middle, and upper back together until you can grasp the bar with straight elbows.",
      "thoracic.flex",
      "top",
      10,
      40,
    ),
    checkJointWithinAt(
      "upright-finish",
      "Torso finishes upright",
      "Finish in a proud-chest posture with your shoulders over your hips, without excessively arching your lower back.",
      "lumbar.flex",
      "bottom",
      -12,
      12,
    ),
    {
      id: "row-with-extension",
      label: "The row and the back extension happen together",
      cue: "The bar should reach your torso at the same moment your torso becomes fully upright.",
      evaluate: ({ angles, top, bottom }) => {
        const round = deg(angles[top]["lumbar.flex"] + angles[top]["thoracic.flex"]);
        const tall = deg(angles[bottom]["lumbar.flex"] + angles[bottom]["thoracic.flex"]);
        const elbow = deg(angles[bottom]["elbow_L.flex"]);
        return {
          pass: round - tall > 24 && elbow > 80,
          measured: `spine ${round.toFixed(0)}° rounded to ${tall.toFixed(0)}°, elbows ${elbow.toFixed(0)}°`,
        };
      },
    },
  ],
});
