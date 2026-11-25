import { Vector3 } from "three";
import { buildExerciseSpec } from "../builders";
import { box, IDENTITY, quatOf, type PropDef } from "../equipment";
import type { ExerciseSpec } from "../exercise";
import { anchorPoint, type Body, type Frame } from "../body";
import type { Vec3 } from "../math";
import { checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import type { Goal } from "../solver";

/** Footplate center of `leg-press-sled-grok.glb`, measured in the exported world frame. */
const PLATE_CENTER: Vec3 = [0, 0.952, 0.286];
/** Slides the frame so the seat lands under the solved hips. Floor stays at y = 0. */
const FRAME_SHIFT: Vec3 = [0, 0, 0.12];
const RAIL: Vec3 = [0, Math.SQRT1_2, Math.SQRT1_2];
/** Up the footplate, toward the lifter's head. */
const PLATE_UP: Vec3 = [0, Math.SQRT1_2, -Math.SQRT1_2];

const SEATED = {
  "root.y": 0.5,
  "root.z": -0.08,
  "root.pitch": -46,
  "hip.abd": 16,
  "hip.rot": 12,
  "lumbar.flex": 4,
  "thoracic.flex": 2,
  "neck.flex": 6,
  "clavicle.elev": 4,
  "shoulder.elev": 22,
  "shoulder.plane": -10,
  "elbow.flex": 72,
  "forearm.pron": 18,
  "wrist.flex": 6,
};

const railV = new Vector3(...RAIL);
const upV = new Vector3(...PLATE_UP);
const footSum = new Vector3();
const delta = new Vector3();
const plateOrigin = new Vector3(
  PLATE_CENTER[0] + FRAME_SHIFT[0],
  PLATE_CENTER[1] + FRAME_SHIFT[1],
  PLATE_CENTER[2] + FRAME_SHIFT[2],
);

function plateCenter(body: Body, frame: Frame): Vector3 {
  footSum.set(0, 0, 0);
  footSum.add(anchorPoint(body, frame, "ballIn_L"));
  footSum.add(anchorPoint(body, frame, "ballIn_R"));
  footSum.multiplyScalar(0.5);
  const origin = new Vector3(
    PLATE_CENTER[0] + FRAME_SHIFT[0],
    PLATE_CENTER[1] + FRAME_SHIFT[1],
    PLATE_CENTER[2] + FRAME_SHIFT[2],
  );
  const t = footSum.sub(origin).dot(railV);
  origin.addScaledVector(railV, t);
  origin.x = 0;
  return origin;
}

/**
 * Keep the sole near the plate and the ball at one height on it.
 * The footplate mesh is shifted down its face, so this height is the upper half.
 * A fully flat sole on a 45° plate would dorsiflex past the form check, so the
 * rail residual is only pulled most of the way closed.
 */
function flatSole(body: Body): Goal {
  return ({ frame, push }) => {
    const heel = anchorPoint(body, frame, "heel_L");
    const ball = anchorPoint(body, frame, "ballIn_L");
    delta.subVectors(ball, heel);
    // 19 closes the heel gap. 22 dorsiflexes past the form check and lifts a foot off the plate.
    push(19 * delta.dot(railV));
    push(6 * (0.16 - delta.dot(upV)));
    push(14 * (ball.dot(upV) - plateOrigin.dot(upV) + 0.14));
  };
}

const base = buildExerciseSpec({
  id: "45-deg-glute-biased-leg-press-grok",
  catalogId: "2aa5c6f170d880c08fcbf27e03a0e2dc",
  name: "45° Glute-Biased Leg Press (grok)",
  defaultLoadKg: 20,
  loadUnit: "total",
  laterality: "bilateral",
  grip: "hang",
  cameraHint: { view: "Side" },
  phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
  tempo: { lower: 2.1, bottom: 0.35, raise: 1.5, top: 0.4 },
  station: { kind: "leg-press", angleDeg: 45, stanceX: 0.24 },
  apparatus: { kind: "leg-press-sled", angleDeg: 45, anchor: "ball" },
  stiffness: { knee: 4.2, hip: 3.2, ankle: 6 },
  hints: {
    start: { ...SEATED, "hip.flex": 60, "knee.flex": 28, "ankle.dorsi": 0 },
    end: { ...SEATED, "hip.flex": 110, "knee.flex": 96, "ankle.dorsi": 2 },
  },
  glb: [{ id: "leg-press-frame-grok", pos: FRAME_SHIFT, hideEquipment: true }],
  extraGoals: (body) => [flatSole(body)],
  checks: () => [
    checkFlatBack(
      "Stop before the buttocks curl off the seat. High foot placement makes the lower back round sooner.",
      12,
    ),
    checkNeutralNeck("Keep the neck near neutral against or just off the backrest."),
    checkJointWithinAt(
      "hips-deep",
      "Hips reach a deep bend",
      "With the feet high on the platform, let the hips bend deeply while the shins stay closer to vertical.",
      "hip_L.flex",
      "peak",
      90,
      125,
    ),
    checkJointWithinAt(
      "shins-up",
      "Shins stay relatively upright",
      "A high foot placement keeps the ankles from folding. Push through the heels with the whole sole down.",
      "ankle_L.dorsi",
      "peak",
      -8,
      14,
    ),
    checkJointRange(
      "hip-rom",
      "Hips lead the glute-biased press",
      "Lower and press by bending and extending the hips, with the knees sharing the motion.",
      "hip_L.flex",
      24,
    ),
    checkJointWithinAt(
      "knees-soft",
      "Knees stay softer than a low-foot press",
      "High feet keep the knees from folding as deeply as a quad-biased setup. They finish only slightly bent.",
      "knee_L.flex",
      "start",
      8,
      52,
    ),
  ],
});

const sled: PropDef = {
  id: "sled",
  kind: "glb",
  glbId: "leg-press-sled-grok",
  // Authored vertices are in the exported world frame. This parks the plate center on the prop origin.
  offset: [-PLATE_CENTER[0], -PLATE_CENTER[1], -PLATE_CENTER[2]],
  colliders: [
    box(
      "sled.plate",
      [0, RAIL[1] * 0.012, RAIL[2] * 0.012],
      [0.84, 1.05, 0.045],
      "steel",
      true,
      quatOf([1, 0, 0], -Math.PI / 4),
    ),
  ],
};

export const spec: ExerciseSpec = {
  ...base,
  build(body) {
    const built = base.build(body);
    return {
      ...built,
      props: built.props.map((prop) => (prop.id === "sled" ? sled : prop)),
      propState: (frame) => {
        const center = plateCenter(body, frame);
        return [{ pos: [center.x, center.y, center.z], quat: IDENTITY }];
      },
    };
  },
};
