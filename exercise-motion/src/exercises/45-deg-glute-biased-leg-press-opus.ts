import { Vector3 } from "three";
import { anchorPoint, SIDES, sideSign, type Body, type Frame, type Side } from "../body";
import { quatFromAxisX } from "../builders";
import { everyFrame } from "../checks";
import { box, compileParts, cylinder, IDENTITY, type Part, type PropDef } from "../equipment";
import type { Built, ExerciseSpec, FormCheck, LoadAttachment, RequiredContact } from "../exercise";
import { rad, type Vec3 } from "../math";
import { PAD_RESTING, checkFlatBack, checkJointRange, checkJointWithinAt, checkNeutralNeck } from "../postures";
import { mirrored, pin, restOnPlane, type Goal, type Obstacle } from "../solver";

/**
 * Real plate-loaded linear leg press (`linearlegpresspure`), split in Blender into a static frame and a sled
 * (carriage, footplate, weight horns, plates) and turned so the sled sits in front of the lifter (+Z).
 * Every number below was measured by ray-casting the GLB, so the solver's pads, footplate and handles sit
 * exactly on the rendered steel and upholstery. The GLB rail is 40° (not a nominal 45°).
 */
const RAIL_UP = new Vector3(0, Math.sin(rad(40)), Math.cos(rad(40)));
const PLATE_NORMAL = new Vector3(0, -0.419, -0.908).normalize();
const PLATE_UP = new Vector3(0, 0.908, -0.419).normalize();
const PLATE_BOTTOM = new Vector3(0, 0.88, 0.228);
const PLATE_LENGTH = 0.48;
const PLATE_WIDTH = 0.668;

const SEAT_V = new Vector3(0, 0.225, -0.467);
const BACK_NORMAL = new Vector3(0, 0.866, 0.5);
const BACK_UP = new Vector3(0, 0.5, -0.866);
const SEAT_NORMAL = new Vector3(0, 0.769, -0.639);
const SEAT_UP = new Vector3(0, 0.639, 0.769);

const HANDLE_CENTER = (side: Side) => new Vector3(sideSign(side) * 0.35, 0.197, -0.456);
const HANDLE_AXIS = new Vector3(0, -0.157, -0.182).normalize();

/** Glute bias: the heel sits just below the plate's midline so the whole foot lands on the upper half. */
const HEEL_ALONG = 0.215;
const STANCE_X = 0.2;
const TOE_OUT = rad(14);

/** Sled travel along the rail from the GLB's bind pose (lockout near the top stop, deep bottom near the lower stop). */
const TRAVEL_TOP = -0.035;
const TRAVEL_BOTTOM = -0.36;

const plateQuat = (() => {
  const x = new Vector3(1, 0, 0);
  return quatFromAxisX(x, PLATE_UP);
})();

function padBox(id: string, origin: Vector3, up: Vector3, normal: Vector3, from: number, to: number, width: number) {
  const thick = 0.07;
  const center = origin
    .clone()
    .addScaledVector(up, (from + to) / 2)
    .addScaledVector(normal, -thick / 2);
  const q = quatFromAxisX(new Vector3(1, 0, 0), normal);
  // quatFromAxisX gives local Y along `normal`; local Z is then along the pad length.
  return box(id, center.toArray() as Vec3, [width, thick, to - from], "pad", true, q);
}

function footSpot(body: Body, side: Side, anchor: string, travel: number) {
  const s = sideSign(side);
  const yaw = s * TOE_OUT;
  const local = body.anchors[anchor].local.clone().sub(body.anchors[`heel_${side}`].local);
  const lx = local.x * Math.cos(yaw) + local.z * Math.sin(yaw);
  const lz = -local.x * Math.sin(yaw) + local.z * Math.cos(yaw);
  return PLATE_BOTTOM.clone()
    .addScaledVector(PLATE_UP, HEEL_ALONG + lz)
    .add(new Vector3(s * STANCE_X + lx, 0, 0))
    .addScaledVector(RAIL_UP, travel);
}

function plantOnPlate(body: Body, side: Side, travelIndex: number, weight = 40): Goal[] {
  return ["heel", "ballIn", "ballOut"].map((name) => {
    const anchor = `${name}_${side}`;
    return pin(body, anchor, (q) => footSpot(body, side, anchor, q[travelIndex]), weight);
  });
}

function feetFlatCheck(): FormCheck {
  return {
    id: "soles-flat",
    label: "Whole sole stays on the footplate",
    cue: "Keep the entire sole of each foot (including the heel, outer aspect of the midfoot, and inner aspect of the midfoot) firmly planted on the platform.",
    evaluate: (context) => {
      const states = context.sequence.propStates;
      return everyFrame(
        context,
        (frame: Frame, _a, i) => {
          const travel = new Vector3(...states[i][0].pos).dot(RAIL_UP);
          const surface = PLATE_BOTTOM.clone().addScaledVector(RAIL_UP, travel);
          let worst = 0;
          for (const side of SIDES) {
            for (const name of ["heel", "ballIn", "ballOut", "toe"]) {
              const p = anchorPoint(context.body, frame, `${name}_${side}`);
              const gap = Math.abs(p.clone().sub(surface).dot(PLATE_NORMAL));
              const along = p.clone().sub(surface).dot(PLATE_UP);
              const overhang = Math.max(0, along - PLATE_LENGTH, -along);
              worst = Math.max(worst, gap, overhang);
            }
          }
          return worst * 1000;
        },
        14,
        " mm off the footplate",
      );
    },
  };
}

function feetHighCheck(): FormCheck {
  return {
    id: "feet-high",
    label: "Feet sit on the upper half of the platform",
    cue: "Place your feet fully on the upper half of the foot platform, mildly outside shoulder width apart, with your toes pointing mildly outward.",
    evaluate: ({ body, frames, sequence, top }) => {
      const travel = new Vector3(...sequence.propStates[top][0].pos).dot(RAIL_UP);
      const surface = PLATE_BOTTOM.clone().addScaledVector(RAIL_UP, travel);
      const mid = (["L", "R"] as Side[]).map((side) => {
        const h = anchorPoint(body, frames[top], `heel_${side}`);
        const t = anchorPoint(body, frames[top], `toe_${side}`);
        return h.add(t).multiplyScalar(0.5).sub(surface).dot(PLATE_UP);
      });
      const width = Math.abs(
        anchorPoint(body, frames[top], "heel_L").x - anchorPoint(body, frames[top], "heel_R").x,
      );
      const centre = Math.min(...mid);
      return {
        pass: centre >= PLATE_LENGTH / 2 && width >= 0.36,
        measured: `mid-foot ${(centre * 100).toFixed(0)} cm up a ${(PLATE_LENGTH * 100).toFixed(0)} cm plate, heels ${(width * 100).toFixed(0)} cm apart`,
      };
    },
  };
}

export const spec: ExerciseSpec = {
  id: "45-deg-glute-biased-leg-press-opus",
  catalogId: "2aa5c6f170d880c08fcbf27e03a0e2dc",
  name: "45° Glute-Biased Leg Press (opus)",
  defaultLoadKg: 60,
  loadUnit: "total",
  laterality: "bilateral",
  build(body: Body): Built {
    const travel = body.dofCount;

    const equipment: Part[] = [
      padBox("lp.backPad", SEAT_V, BACK_UP, BACK_NORMAL, 0, 0.86, 0.38),
      padBox("lp.seatPad", SEAT_V, SEAT_UP, SEAT_NORMAL, 0, 0.27, 0.38),
      ...SIDES.map((side) =>
        cylinder(
          `lp.handle_${side}`,
          HANDLE_CENTER(side).toArray() as Vec3,
          0.017,
          0.24,
          "rubber",
          quatFromAxisX(HANDLE_AXIS.clone()),
        ),
      ),
    ];

    const plateCenter = PLATE_BOTTOM.clone()
      .addScaledVector(PLATE_UP, PLATE_LENGTH / 2)
      .addScaledVector(PLATE_NORMAL, -0.02);
    const sled: PropDef = {
      id: "sled",
      kind: "glb",
      glbId: "linearlegpress-sled-opus",
      colliders: [
        box("sled.plate", plateCenter.toArray() as Vec3, [PLATE_WIDTH, PLATE_LENGTH, 0.04], "steel", true, plateQuat),
      ],
    };

    const contacts: Record<string, Record<string, number>> = {
      "lp.backPad": { ...PAD_RESTING },
      "lp.seatPad": { ...PAD_RESTING },
      "lp.handle": { hand_L: 0.05, hand_R: 0.05, forearm_L: 0.02, forearm_R: 0.02 },
      sled: { foot_L: 0.04, foot_R: 0.04 },
    };
    const obstacles: Obstacle[] = compileParts(equipment).map((shape) => ({
      shape,
      allow: shape.part.id.startsWith("lp.handle") ? contacts["lp.handle"] : contacts[shape.part.id],
    }));

    const goals: Goal[] = [
      restOnPlane(body, "sacrum", SEAT_V, BACK_NORMAL, 40, 0.012),
      restOnPlane(body, "pelvisBottom", SEAT_V, SEAT_NORMAL, 40, 0.014),
      pin(body, "sacrum", () => new Vector3(0, 0, 0), 30, "x"),
      restOnPlane(body, "upperBack", SEAT_V, BACK_NORMAL, 38, 0.01),
      restOnPlane(body, "occiput", SEAT_V, BACK_NORMAL, 20, 0.008),
      ...SIDES.flatMap((side) => [
        ...plantOnPlate(body, side, travel),
        pin(body, `grip_${side}`, () => HANDLE_CENTER(side), 26),
      ]),
      mirrored(body, 5),
    ];

    const forceDir = RAIL_UP.clone().negate().toArray() as Vec3;
    const loads: LoadAttachment[] = SIDES.flatMap((side) => [
      { anchor: `heel_${side}`, share: 0.3, grip: "rest" as const, direction: forceDir },
      { anchor: `ballIn_${side}`, share: 0.2, grip: "rest" as const, direction: forceDir },
    ]);
    const required: RequiredContact[] = [
      { label: "Back on backrest", anchor: "upperBack", part: "lp.backPad", allowSlide: true },
      { label: "Buttocks on seat", anchor: "sacrum", part: "lp.backPad" },
      ...SIDES.flatMap((side): RequiredContact[] => [
        { label: `${side === "L" ? "Left" : "Right"} heel on footplate`, anchor: `heel_${side}`, prop: "sled" },
        { label: `${side === "L" ? "Left" : "Right"} ball of foot on footplate`, anchor: `ballIn_${side}`, prop: "sled" },
        { label: `${side === "L" ? "Left" : "Right"} hand on handle`, anchor: `grip_${side}`, part: `lp.handle_${side}` },
      ]),
    ];

    const seated = {
      "root.y": 0.36,
      "root.z": -0.42,
      "root.pitch": -58,
      "hip.abd": 16,
      "hip.rot": 14,
      "lumbar.flex": 2,
      "thoracic.flex": 4,
      "neck.flex": 14,
      "clavicle.elev": 2,
      "shoulder.elev": 22,
      "shoulder.plane": 20,
      "elbow.flex": 30,
      "forearm.pron": 0,
      "wrist.flex": 0,
    };

    return {
      hints: {
        start: { ...seated, "hip.flex": 62, "knee.flex": 14, "ankle.dorsi": -4 },
        end: { ...seated, "hip.flex": 118, "knee.flex": 98, "ankle.dorsi": 8 },
      },
      phaseLabels: ["Lower", "Bottom", "Press", "Lockout"],
      extras: 1,
      extraStart: [TRAVEL_TOP],
      goals,
      keyGoals: {
        start: [({ q, push }) => push(60 * (q[travel] - TRAVEL_TOP))],
        end: [({ q, push }) => push(60 * (q[travel] - TRAVEL_BOTTOM))],
      },
      stiffness: {
        default: 0.5,
        root: 0.3,
        knee: 2.4,
        hip: 2.6,
        ankle: 2.2,
        lumbar: 22,
        thoracic: 16,
        wrist: 7,
        forearm: 2,
        neck: 4,
        clavicle: 3,
        shoulder: 1.2,
        elbow: 1.5,
      },
      obstacles,
      progress: (frame) => -anchorPoint(body, frame, "heel_L").dot(RAIL_UP),
      ground: "sacrum",
      props: [sled],
      propState: (_frame, ex) => [
        { pos: RAIL_UP.clone().multiplyScalar(ex[0]).toArray() as Vec3, quat: IDENTITY },
      ],
      equipment: () => equipment,
      glb: [{ id: "linearlegpress-frame-opus", pos: [0, 0, 0], hideEquipment: true }],
      loads,
      support: {
        kind: "lying",
        passive: ["lumbar", "thoracic", "neck", "clavicle", "shoulder", "elbow", "forearm", "wrist"],
        brace: true,
      },
      tempo: { lower: 2.1, bottom: 0.35, raise: 1.5, top: 0.4 },
      contacts,
      required,
      laterality: "bilateral",
      grip: "hang",
      cameraHint: { view: "Side" },
      checks: [
        feetFlatCheck(),
        feetHighCheck(),
        checkFlatBack(
          "Continue keeping your buttocks firmly planted on the seat and your back snugly up against the backrest.",
          12,
        ),
        checkNeutralNeck("Keep your neck near a neutral position, like when you are normally looking straight ahead while standing upright."),
        checkJointWithinAt(
          "hips-deep",
          "Hips bend deeply at the bottom",
          "Lower the sled toward you in a controlled manner by simultaneously bending at your knees and hips.",
          "hip_L.flex",
          "peak",
          100,
          130,
        ),
        checkJointWithinAt(
          "shins-up",
          "Shins stay relatively upright",
          "While placing your feet higher on the platform may help bias your glutes, keep the heels fully on the platform.",
          "ankle_L.dorsi",
          "peak",
          -12,
          18,
        ),
        checkJointWithinAt(
          "soft-lockout",
          "Knees straight or just slightly bent at the top",
          "Your knees should now be straight or just slightly bent.",
          "knee_L.flex",
          "start",
          3,
          30,
        ),
        checkJointRange(
          "hip-rom",
          "Hips drive the press",
          "Drive your feet into the platform to push the sled away from you as you simultaneously extend your knees and hips.",
          "hip_L.flex",
          35,
        ),
      ],
    };
  },
};
