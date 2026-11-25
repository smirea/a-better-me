import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";

const GRIP = {
  "shoulder.twist": 14,
  "forearm.pron": 75,
  "wrist.flex": 6,
};

const SPINE = {
  "lumbar.flex": 6,
  "thoracic.flex": 8,
  "neck.flex": -8,
  "hip.abd": 6,
  "knee.flex": 32,
  "ankle.dorsi": 8,
};

export const spec = buildExerciseSpec({
  id: "barbell-cheat-row",
  catalogId: "1a15c6f170d8801ab4e9f6fd8b9576fb",
  name: "Barbell Cheat Row",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Cheat", "Abdomen", "Sit back", "Hang"],
  tempo: { lower: 1.3, bottom: 0.3, raise: 1.15, top: 0.35 },
  station: { kind: "standing", stanceX: 0.16, toeOutDeg: 8 },
  apparatus: {
    kind: "barbell",
    style: "straight",
    gripX: 0.24,
    path: { startY: 0.44, startZ: 0.22, endY: 0.92, endZ: 0.16 },
  },
  hints: {
    start: {
      ...POSTURE_HINTS.standing,
      ...SPINE,
      ...GRIP,
      "root.y": 0.84,
      "root.z": -0.12,
      "root.pitch": 62,
      "hip.flex": 82,
      "shoulder.elev": 54,
      "shoulder.plane": 74,
      "elbow.flex": 6,
      "clavicle.prot": 8,
      "clavicle.elev": 4,
    },
    end: {
      ...POSTURE_HINTS.standing,
      ...SPINE,
      ...GRIP,
      "root.y": 0.9,
      "root.z": -0.04,
      "root.pitch": 45,
      "hip.flex": 52,
      "shoulder.elev": 34,
      "shoulder.plane": 42,
      "elbow.flex": 112,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack(
      "Keep your back flat and your core braced. When your hips help the bar up, your spine stays rigid.",
    ),
    checkNeutralNeck(
      "Keep your lower back near a neutral position rather than rounding over to move the bar.",
    ),
    checkJointRange(
      "hip-snap",
      "Hips help the pull",
      "Let your hips snap forward so your torso rises into a more upright, still inclined position as you pull.",
      "hip_L.flex",
      18,
    ),
    checkJointRange(
      "elbow-drive",
      "Elbows drive the bar to the abdomen",
      "Explosively pull the bar up toward your abdomen by driving your elbows backward and upward.",
      "elbow_L.flex",
      70,
    ),
    checkJointWithinAt(
      "still-inclined",
      "Torso stays inclined at the top",
      "Finish with your torso still somewhat inclined, not locked out upright like a deadlift, so your elbows can finish behind your torso.",
      "hip_L.flex",
      "peak",
      38,
      68,
    ),
    checkJointWithinAt(
      "plates-off-floor",
      "Hang above the floor",
      "Start hinged with straight elbows and the plates above the ground, just in front of your legs.",
      "elbow_L.flex",
      "start",
      0,
      24,
    ),
  ],
});
