import { Vector3 } from "three";
import { buildExerciseSpec, POSTURE_HINTS } from "../builders";
import { box } from "../equipment";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { pin } from "../solver";

/** Standing hinge with the chest resting on the top edge of a low incline bench. */
const CHEST = new Vector3(0, 0.9, 0.2);

const GRIP = {
  "shoulder.twist": 8,
  "forearm.pron": 40,
  "wrist.flex": 4,
};

const HINGE = {
  ...POSTURE_HINTS.standing,
  "root.y": 0.86,
  "root.z": -0.08,
  "root.pitch": 64,
  "hip.flex": 82,
  "hip.abd": 8,
  "knee.flex": 22,
  "ankle.dorsi": 8,
  "lumbar.flex": 4,
  "thoracic.flex": 6,
  "neck.flex": -4,
};

export const spec = buildExerciseSpec({
  id: "dumbbell-helms-row",
  catalogId: "2a05c6f170d8804393a7c415bfa49b90",
  name: "Dumbbell Helms Row",
  defaultLoadKg: 12,
  loadUnit: "perSide",
  laterality: "bilateral",
  grip: "hang",
  phaseLabels: ["Row", "Flare", "Lower", "Hang"],
  tempo: { lower: 1.2, bottom: 0.25, raise: 1.5, top: 0.3 },
  station: { kind: "standing", stanceX: 0.18, heelZ: 0, toeOutDeg: 8, torsoLeanDeg: 62 },
  apparatus: { kind: "dumbbells" },
  extraEquipment: [
    box("bench.head", [0, CHEST.y - 0.02, CHEST.z], [0.28, 0.07, 0.16], "pad"),
    box("bench.post", [0, 0.44, CHEST.z + 0.12], [0.05, 0.84, 0.05], "steel", false),
  ],
  extraContacts: {
    "bench.head": { chest: 0.06, abdomen: 0.04 },
  },
  extraGoals: (body) => [pin(body, "chestFront", () => CHEST.clone(), 16)],
  hints: {
    start: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 50,
      "shoulder.plane": 68,
      "elbow.flex": 8,
      "clavicle.prot": 2,
      "clavicle.elev": 4,
    },
    end: {
      ...HINGE,
      ...GRIP,
      "shoulder.elev": 36,
      "shoulder.plane": 18,
      "elbow.flex": 102,
      "clavicle.prot": -14,
      "clavicle.elev": 10,
    },
  },
  checks: () => [
    checkFlatBack("Keep your lower back flat and your chest on the top edge of the bench for the whole set."),
    checkNeutralNeck("Keep your head above the bench with your neck near the position you use when standing."),
    checkJointRange(
      "helms-row",
      "Elbows arc back and out",
      "Drive your elbows backward, upward, and about 45 degrees out from your sides while your chest stays on the bench.",
      "elbow_L.flex",
      60,
    ),
    checkJointWithinAt(
      "hybrid",
      "Hybrid overhand grip",
      "Angle your palms diagonally backward and in toward each other.",
      "forearm_L.pron",
      "start",
      15,
      65,
    ),
    checkJointWithinAt(
      "flare",
      "Elbows finish flared by the torso",
      "Finish with the elbows level with the torso or slightly behind it, flared about 45 degrees.",
      "shoulder_L.plane",
      "peak",
      8,
      28,
    ),
  ],
});
