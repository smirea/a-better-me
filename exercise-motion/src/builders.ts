import { Matrix4, Quaternion, Vector3 } from "three";
import {
  anchorPoint,
  SIDES,
  sideSign,
  worldPoint,
  type Body,
  type Frame,
  type PoseHints,
  type Side,
} from "./body";
import {
  adjustableBench,
  BAR_RADIUS,
  benchRack,
  cableAttachmentProp,
  cableColumn,
  cableCrossover,
  calfRaiseStation,
  cardioMachine,
  compileParts,
  dipStation,
  exerciseMat,
  ezBar,
  flatBench,
  ghdBench,
  gymRingProp,
  hackSquatMachine,
  IDENTITY,
  landmineBase,
  latPulldownMachine,
  legExtensionMachine,
  legPressFrame,
  legPressSledProp,
  lyingLegCurlMachine,
  machineHandleProp,
  olympicBar,
  platformBox,
  pointOnPad,
  powerRack,
  preacherBench,
  prowlerSledProp,
  pullUpStation,
  rollerPadProp,
  romanChair,
  safetySquatBar,
  seatedMachineFrame,
  seatedRowMachine,
  smithMachine,
  splitSquatStand,
  stabilityBall,
  trapBar,
  axleBar,
  abWheelProp,
  type BarbellStyle,
  type Part,
  type PropDef,
  type PropState,
  type TetherDef,
} from "./equipment";
import type {
  Built,
  CameraHint,
  ExerciseSpec,
  FormCheck,
  GripStyle,
  Laterality,
  LoadAttachment,
  RequiredContact,
  Support,
  Tempo,
  WaypointSpec,
} from "./exercise";
import { rad, type Vec3 } from "./math";
import {
  PAD_RESTING,
  POSTURE_HINTS,
  alignBarWrists,
  plantBothFeet,
  plantBothToes,
  restBackOnPad,
  sitOnSeat,
} from "./postures";
import {
  aim,
  balance,
  keepAbove,
  kneeOverToes,
  lockAngle,
  mirrored,
  pin,
  plantFoot,
  plantToe,
  type Goal,
  type Obstacle,
} from "./solver";

export const HANDLE_QUAT = new Quaternion().setFromUnitVectors(
  new Vector3(1, 0, 0),
  new Vector3(0, 0, 1),
);

const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const BASIS = new Matrix4();

export function quatFromAxisX(axisX: Vector3, upHint = Y_AXIS): [number, number, number, number] {
  const x = axisX.clone();
  if (x.lengthSq() < 1e-8) return IDENTITY;
  x.normalize();
  const z = new Vector3().crossVectors(x, upHint);
  if (z.lengthSq() < 1e-6) z.crossVectors(x, Z_AXIS);
  z.normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  BASIS.makeBasis(x, y, z);
  const q = new Quaternion().setFromRotationMatrix(BASIS);
  return [q.x, q.y, q.z, q.w];
}

export function propAtGrip(
  body: Body,
  frame: Frame,
  side: Side,
  anchorPrefix: "grip" | "press" | "palmFlat" = "grip",
  hangVertical = false,
): PropState {
  const pt = anchorPoint(body, frame, `${anchorPrefix}_${side}`);
  const wristRot = frame.rot[body.index[`wrist_${side}`]];
  if (hangVertical) {
    const handleAxis = Z_AXIS.clone().applyQuaternion(wristRot);
    handleAxis.y = 0;
    if (handleAxis.lengthSq() < 1e-4) handleAxis.set(1, 0, 0);
    return { pos: [pt.x, pt.y, pt.z], quat: quatFromAxisX(handleAxis, Y_AXIS) };
  }
  const q = wristRot.clone().multiply(HANDLE_QUAT);
  return { pos: [pt.x, pt.y, pt.z], quat: [q.x, q.y, q.z, q.w] };
}

export function barBetweenAnchors(
  body: Body,
  frame: Frame,
  anchorL: string,
  anchorR: string,
  offsetY = 0,
  offsetZ = 0,
): PropState {
  const pL = anchorPoint(body, frame, anchorL);
  const pR = anchorPoint(body, frame, anchorR);
  const mid = pL.clone().add(pR).multiplyScalar(0.5);
  const axis = pL.clone().sub(pR);
  return {
    pos: [mid.x, mid.y + offsetY, mid.z + offsetZ],
    quat: quatFromAxisX(axis, Y_AXIS),
  };
}

export function rollerOnAnchors(
  body: Body,
  frame: Frame,
  anchors: string[],
  offset: Vec3 = [0, 0, 0],
  localOffset?: Vec3,
): PropState {
  const sum = new Vector3();
  const localVec = localOffset ? new Vector3(...localOffset) : null;
  const worldOff = new Vector3();
  for (const a of anchors) {
    sum.add(anchorPoint(body, frame, a));
    if (localVec) {
      const joint = body.anchors[a].joint;
      sum.add(worldOff.copy(localVec).applyQuaternion(frame.rot[joint]));
    }
  }
  sum.divideScalar(Math.max(1, anchors.length));
  return {
    pos: [sum.x + offset[0], sum.y + offset[1], sum.z + offset[2]],
    quat: IDENTITY,
  };
}

/** Builds unilateral or side-specific hints: applies `active` to `side` and `inactive` to the opposite side. */
export function sidedHints(
  activeSide: Side,
  active: PoseHints,
  inactive: PoseHints = {},
  shared: PoseHints = {},
): PoseHints {
  const other: Side = activeSide === "L" ? "R" : "L";
  const out: PoseHints = { ...shared };
  const put = (src: PoseHints, side: Side) => {
    for (const [k, v] of Object.entries(src)) {
      if (k.includes("_L.") || k.includes("_R.") || k.startsWith("root.") || k.startsWith("lumbar.") || k.startsWith("thoracic.") || k.startsWith("neck.")) {
        out[k] = v;
      } else {
        const dot = k.indexOf(".");
        if (dot > 0) out[`${k.slice(0, dot)}_${side}${k.slice(dot)}`] = v;
        else out[k] = v;
      }
    }
  };
  put(inactive, other);
  put(active, activeSide);
  return out;
}

/** Mirrors every `_L`/`_R` key and negates lateral/rotational trunk DOFs (`bend`, `twist`, `root.x`, `root.yaw`, `root.roll`). */
export function mirrorHints(hints: PoseHints): PoseHints {
  const out: PoseHints = {};
  for (const [k, v] of Object.entries(hints)) {
    if (k.includes("_L.")) {
      out[k.replace("_L.", "_R.")] = v;
    } else if (k.includes("_R.")) {
      out[k.replace("_R.", "_L.")] = v;
    } else if (
      k === "root.x" ||
      k === "root.yaw" ||
      k === "root.roll" ||
      k.endsWith(".bend") ||
      k.endsWith(".twist")
    ) {
      out[k] = -v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function keepHandsOnBar(
  body: Body,
  gripX: number,
  anchorPrefix: "grip" | "press" = "grip",
  weight = 24,
): Goal {
  const aL = body.anchors[`${anchorPrefix}_L`];
  const aR = body.anchors[`${anchorPrefix}_R`];
  const pL = new Vector3();
  const pR = new Vector3();
  return ({ frame, push }) => {
    worldPoint(frame, aL.joint, aL.local, pL);
    worldPoint(frame, aR.joint, aR.local, pR);
    push(weight * (pL.x - gripX));
    push(weight * (pR.x + gripX));
    push(weight * (pL.y - pR.y));
    push(weight * (pL.z - pR.z));
  };
}

export function holdElbowNearShoulder(
  body: Body,
  side: Side,
  offset: Vec3 = [0, -0.29, 0.02],
  weight = 12,
  axes = "xz",
): Goal {
  const s = sideSign(side);
  const shIdx = body.index[`shoulder_${side}`];
  const elIdx = body.index[`elbow_${side}`];
  return ({ frame, push }) => {
    const sh = frame.pos[shIdx];
    const el = frame.pos[elIdx];
    if (axes.includes("x")) push(weight * (el.x - (sh.x + s * offset[0])));
    if (axes.includes("y")) push(weight * (el.y - (sh.y + offset[1])));
    if (axes.includes("z")) push(weight * (el.z - (sh.z + offset[2])));
  };
}

export function lockTorsoPitch(body: Body, targetDeg: number, weight = 32): Goal {
  const up = new Vector3();
  const targetRad = rad(targetDeg);
  return ({ frame, push }) => {
    up.set(0, 1, 0).applyQuaternion(frame.rot[body.index.thoracic]);
    push(weight * (Math.atan2(up.z, up.y) - targetRad));
  };
}

export type StationConfig =
  | {
      kind: "standing";
      stanceX?: number;
      heelZ?: number;
      toeOutDeg?: number;
      surfaceY?: number;
      /** Optional split / staggered stance: front foot side + z, rear foot z + mode. */
      split?: {
        frontSide?: Side;
        frontZ: number;
        rearZ: number;
        rearMode?: "flat" | "toe" | "elevated-stand" | "elevated-bench";
        rearY?: number;
      };
      /** Single-leg standing (only `singleFoot` touches floor). */
      singleFoot?: Side;
      /** Platform box under feet (deficit deadlift, step-up, calf block). */
      box?: { height: number; width?: number; depth?: number; z?: number };
      /** Add power rack frame around lifter. */
      rack?: { hookY?: number; safetyY?: number; zCenter?: number };
      /** Add Smith machine rails around lifter (sets `support.rail = true`). */
      smith?: { stopY?: number };
      /** Optional knees-over-toes tracking weight (great for squats/lunges). */
      trackKnees?: number;
      /** Optional fore-aft CoM balance z target (default midfoot). Set false to disable balance goal. */
      balanceZ?: number | false;
      torsoLeanDeg?: number;
    }
  | {
      kind: "seated";
      seatY?: number;
      seatZ?: number;
      stanceX?: number;
      heelZ?: number;
      toeOutDeg?: number;
      leanDeg?: number;
      /** Backrest or station type. */
      frame?:
        | { type: "flat-bench"; zHead?: number; zFoot?: number }
        | { type: "adjustable-bench"; backAngleDeg: number; seatTiltDeg?: number; hingeZ?: number; ankleRollers?: boolean }
        | { type: "machine"; backAngleDeg?: number; chestPadZ?: number; chestPadY?: number; stackZ?: number }
        | { type: "lat-pulldown"; thighPadY?: number; pulleyZ?: number; columnZ?: number }
        | { type: "seated-row"; pulleyY?: number; pulleyZ?: number }
        | { type: "preacher"; padTopY?: number; padTopZ?: number }
        | { type: "leg-extension"; backAngleDeg?: number; thighRollerY?: number }
        | { type: "box"; height?: number };
      feetMode?: "floor" | "footplate" | "hanging";
      pinBack?: boolean;
      pinHead?: boolean;
      pinHandles?: boolean;
      /** Locks hip flexion on both legs (useful on leg extension / curl machines so thighs stay level on the seat). */
      lockHipFlexDeg?: number;
      passiveJoints?: string[];
    }
  | {
      kind: "lying";
      surface: "flat-bench" | "adjustable-bench" | "floor" | "stability-ball" | "lying-leg-curl";
      face: "up" | "down" | "side";
      backAngleDeg?: number;
      benchTopY?: number;
      ankleRollers?: boolean;
      rack?: { hookY?: number; safetyY?: number };
      smith?: { stopY?: number };
      stanceX?: number;
      heelZ?: number;
      feetOnFloor?: boolean;
      passiveJoints?: string[];
    }
  | {
      kind: "kneeling";
      halfKneelingSide?: Side;
      surfaceY?: number;
      mat?: boolean;
      leanDeg?: number;
    }
  | {
      kind: "hanging";
      barY?: number;
      barZ?: number;
      width?: number;
      assisted?: boolean;
    }
  | {
      kind: "dip";
      barY?: number;
      spacing?: number;
      z?: number;
      assisted?: boolean;
    }
  | {
      kind: "pushup";
      handX?: number;
      handZ?: number;
      handElevationY?: number;
      feetElevationY?: number;
      kneesOnFloor?: boolean;
      forearmsOnFloor?: boolean;
      footZ?: number;
      footX?: number;
    }
  | {
      kind: "leg-press";
      angleDeg?: number;
      stanceX?: number;
      footYStart?: number;
      footZStart?: number;
      footYEnd?: number;
      footZEnd?: number;
      singleLeg?: Side;
    }
  | {
      kind: "hack-squat";
      angleDeg?: number;
      stanceX?: number;
    }
  | {
      kind: "roman-chair" | "ghd";
      padY?: number;
    }
  | {
      kind: "hip-thrust";
      benchTopY?: number;
      stanceX?: number;
      heelZ?: number;
    }
  | {
      kind: "calf-station";
      mode: "standing" | "seated";
      blockY?: number;
      seatY?: number;
      stanceX?: number;
      singleFoot?: Side;
    }
  | {
      kind: "cardio";
      machine: "treadmill" | "bike" | "rower" | "elliptical" | "stair-climber" | "skierg" | "none";
    };

export type ApparatusConfig =
  | {
      kind: "none";
      /** Optional bodyweight reaction load so closed-chain bodyweight exercises light up muscles realistically. */
      bodyweightLoads?: {
        anchor: string;
        bodyweightShare: number;
        share?: number;
        grip?: "hang" | "press" | "rest";
        direction?: Vec3;
      }[];
    }
  | {
      kind: "barbell";
      style?: BarbellStyle;
      gripX: number;
      anchor?: "grip" | "press";
      /** Optional extra rest anchor (e.g. `"traps"`, `"frontRack_L"`, `"pelvisFront"`) carrying the weight. */
      restAnchor?: string;
      /** Keep bar constrained to a straight world path between `startPos` and `endPos` via extras. */
      path?: {
        startY: number;
        startZ: number;
        endY: number;
        endZ: number;
        arcBulgeZ?: number;
        arcBulgeY?: number;
      };
      alignWrists?: boolean;
    }
  | {
      kind: "dumbbells";
      sides?: Side[];
      anchor?: "grip" | "press";
      fatGrip?: boolean;
      /** Optional hand world-path targets (for presses/rows); omit to drive via joint angles! */
      handPath?: {
        start: Vec3;
        end: Vec3;
        arcBulge?: Vec3;
      };
    }
  | {
      kind: "kettlebells";
      sides?: Side[];
      hangVertical?: boolean;
      twoHandsOnOne?: boolean;
    }
  | {
      kind: "plate" | "medball";
      sides?: Side[];
      twoHandsOnOne?: boolean;
    }
  | {
      kind: "cable-single";
      pulley: Vec3;
      columnPos?: [number, number];
      facingDir?: 1 | -1;
      /** Omit column parts if the station (e.g. lat-pulldown / seated-row) already built the column. */
      skipColumn?: boolean;
      attachment: "d-handle" | "straight-bar" | "lat-bar" | "v-bar" | "rope" | "ankle-cuff";
      attachmentWidth?: number;
      sides?: Side[];
      gripX?: number;
      /** Attach cable to a specific non-hand anchor (e.g. `"ankleCuff_L"`, `"forehead"`). */
      anchor?: string;
      twoHandsOnOne?: boolean;
      handPath?: { startY: number; startZ: number; endY: number; endZ: number; arcBulgeZ?: number };
    }
  | {
      kind: "cable-dual";
      pulleyY: number;
      halfWidth?: number;
      z?: number;
      attachment?: "d-handle" | "rope" | "ankle-cuff";
      sides?: Side[];
      anchor?: "grip" | "press" | "ankleCuff";
    }
  | {
      kind: "band";
      anchors: Vec3[];
      sides?: Side[];
      targetAnchors?: string[];
      handle?: boolean;
    }
  | {
      kind: "machine-handles";
      orientation?: "horizontal" | "neutral";
      sides?: Side[];
      anchor?: "grip" | "press";
      forceDir: Vec3;
      gripX?: number;
      handPath?: { start: Vec3; end: Vec3; arcBulge?: Vec3 };
    }
  | {
      kind: "roller-pad";
      width?: number;
      radius?: number;
      trackAnchors: string[];
      offset?: Vec3;
      /** Offset in the tracked anchor's local joint frame (e.g. `[0, 0, 0.055]` stays on the front of the shin through the full knee arc). */
      localOffset?: Vec3;
      /** Pulley point or fixed direction defining resistance on `trackAnchors`. */
      pulley?: Vec3;
      forceDir?: Vec3;
    }
  | {
      kind: "landmine";
      pivotZ?: number;
      sides?: Side[];
      twoHandsOnOne?: boolean;
    }
  | {
      kind: "ab-wheel";
    }
  | {
      kind: "rings";
      anchorY?: number;
      spacing?: number;
      bodyweightShare?: number;
    }
  | {
      kind: "prowler-sled";
      sledOffsetZ?: number;
    }
  | {
      kind: "leg-press-sled";
      angleDeg?: number;
    };

export interface ExerciseBuilderConfig {
  id: string;
  catalogId: string;
  name: string;
  defaultLoadKg: number;
  loadUnit: "total" | "perSide";
  laterality?: Laterality;
  /** Active working side for `"unilateral"` exercises (default `"L"`). */
  activeSide?: Side;
  grip?: GripStyle;
  cameraHint?: CameraHint;
  phaseLabels?: [string, string, string, string];
  tempo?: Tempo;
  isometric?: boolean;

  station: StationConfig;
  apparatus: ApparatusConfig;

  /** Start & end pose hints (degrees; omit `_L`/`_R` for bilateral, or use `sidedHints` for unilateral/asymmetrical). */
  hints: { start: PoseHints; end: PoseHints };
  /** Optional custom multi-waypoint poses (overrides `hints` for cyclic/Olympic/alternating specs). */
  waypoints?: WaypointSpec[];
  loopMode?: "cycle" | "pingpong";

  /** Optional stiffness overrides merged onto tuned defaults. */
  stiffness?: Record<string, number>;
  /** Anchor kept fixed while interpolating poses (auto-inferred from `station` when omitted). */
  ground?: string;
  /** Progress scalar tracked between start and end (auto-inferred when omitted). */
  progress?: (body: Body, frame: Frame) => number;
  /** Additional solver goals applied every frame. */
  extraGoals?: (body: Body) => Goal[];
  /** Additional key-frame goals at start/end. */
  extraKeyGoals?: (body: Body) => { start?: Goal[]; end?: Goal[] };
  /** Additional static equipment parts. */
  extraEquipment?: Part[];
  /** Additional contact allowances merged into `contacts` and `obstacles`. */
  extraContacts?: Record<string, Record<string, number>>;
  /** Additional required contacts. */
  extraRequired?: RequiredContact[];
  /** Override brace flag (default true). */
  brace?: boolean;

  /** Catalog-quoted biomechanical form checks (minimum 2 required). */
  checks: (body: Body) => FormCheck[];
}

function makeBarProp(style: BarbellStyle = "straight"): PropDef {
  if (style === "ez") return ezBar("bar");
  if (style === "trap") return trapBar("bar");
  if (style === "ssb") return safetySquatBar("bar");
  if (style === "axle") return axleBar("bar");
  return olympicBar("bar");
}

const DEFAULT_STIFFNESS: Record<string, number> = {
  default: 0.55,
  root: 4,
  lumbar: 5.5,
  thoracic: 5.5,
  neck: 3,
  clavicle: 3,
  hip: 0.9,
  knee: 0.9,
  ankle: 0.5,
  shoulder: 0.55,
  elbow: 1.5,
  forearm: 1.4,
  wrist: 2.2,
};

const HAND_ALLOW = {
  hand_L: 0.07,
  hand_R: 0.07,
  forearm_L: 0.035,
  forearm_R: 0.035,
};

export function buildExerciseSpec(config: ExerciseBuilderConfig): ExerciseSpec {
  const laterality: Laterality = config.laterality ?? "bilateral";
  const activeSide: Side = config.activeSide ?? "L";

  return {
    id: config.id,
    catalogId: config.catalogId,
    name: config.name,
    defaultLoadKg: config.defaultLoadKg,
    loadUnit: config.loadUnit,
    laterality,
    build(body: Body): Built {
      const goals: Goal[] = [];
      const keyStart: Goal[] = [];
      const keyEnd: Goal[] = [];
      const staticParts: Part[] = [...(config.extraEquipment ?? [])];
      const obstacles: Obstacle[] = [];
      const contacts: Record<string, Record<string, number>> = { ...config.extraContacts };
      const required: RequiredContact[] = [...(config.extraRequired ?? [])];
      const props: PropDef[] = [];
      const tethers: TetherDef[] = [];
      const loads: LoadAttachment[] = [];
      let extras = 0;
      const extraStart: number[] = [];
      let pathFn: Built["path"] | undefined;
      let propStateFn: Built["propState"] = () => [];
      let tetherStateFn: Built["tetherState"] | undefined;

      const addContacts = (prefix: string, map: Record<string, number>) => {
        contacts[prefix] = { ...map, ...contacts[prefix] };
      };
      const addPartObstacles = (parts: Part[], padIds: string[] = []) => {
        const shapes = compileParts(parts.filter((p) => p.collide));
        for (const s of shapes) {
          const isPad =
            s.part.material === "pad" ||
            padIds.some((id) => s.part.id.startsWith(id));
          if (isPad) {
            const allow = { ...PAD_RESTING, ...contacts[s.part.id] };
            addContacts(s.part.id, allow);
            obstacles.push({ shape: s, allow });
          } else {
            obstacles.push({ shape: s, allow: contacts[s.part.id] ?? {} });
          }
        }
      };

      // 1. Station geometry, support, grounding, and posture constraints
      let support: Support = { kind: "standing", brace: config.brace ?? true };
      let ground = config.ground ?? "heel_L";
      let stationPulley: Vec3 | undefined;
      let legPressRailDir: Vec3 | undefined;
      let smithRail = false;
      let benchRackOpts: { hookY?: number; safetyY?: number } | undefined;
      let dynamicEquipmentFn: Built["equipment"] | undefined;

      const st = config.station;
      if (st.kind === "standing") {
        const stanceX = st.stanceX ?? 0.16;
        const heelZ = st.heelZ ?? 0;
        const toeOut = rad(st.toeOutDeg ?? 10);
        const surfY = st.surfaceY ?? (st.box ? st.box.height : 0);
        if (st.box) {
          const bp = platformBox("step.box", [0, 0, st.box.z ?? 0.08], st.box.width ?? 0.72, st.box.height, st.box.depth ?? 0.52);
          staticParts.push(...bp);
          addContacts("step.box", { foot_L: 0.03, foot_R: 0.03 });
        }
        if (st.rack) {
          staticParts.push(...powerRack(st.rack).parts);
        }
        if (st.smith) {
          smithRail = true;
          support = { kind: "standing", rail: true, brace: config.brace ?? true };
          staticParts.push(...smithMachine({ stopY: st.smith.stopY ?? 0.55 }));
        }
        if (st.singleFoot) {
          const side = st.singleFoot;
          const s = sideSign(side);
          goals.push(...plantFoot(body, side, new Vector3(s * Math.min(stanceX, 0.08), surfY, heelZ), toeOut));
          required.push(
            { label: `${side === "L" ? "Left" : "Right"} heel planted`, anchor: `heel_${side}`, surfaceY: surfY },
            { label: `${side === "L" ? "Left" : "Right"} forefoot planted`, anchor: `ballIn_${side}`, surfaceY: surfY },
          );
          support = { ...support, feet: [side] };
          ground = config.ground ?? `heel_${side}`;
        } else if (st.split) {
          const frontSide = st.split.frontSide ?? "L";
          const rearSide: Side = frontSide === "L" ? "R" : "L";
          const sf = sideSign(frontSide);
          const sr = sideSign(rearSide);
          goals.push(...plantFoot(body, frontSide, new Vector3(sf * stanceX, surfY, st.split.frontZ), toeOut));
          required.push(
            { label: "Front heel planted", anchor: `heel_${frontSide}`, surfaceY: surfY },
            { label: "Front forefoot planted", anchor: `ballIn_${frontSide}`, surfaceY: surfY },
          );
          const rearMode = st.split.rearMode ?? "toe";
          const rearY = st.split.rearY ?? (rearMode === "elevated-stand" || rearMode === "elevated-bench" ? 0.44 : 0);
          if (rearMode === "elevated-stand") {
            const stand = splitSquatStand(rearY, st.split.rearZ);
            staticParts.push(...stand.parts);
            addContacts("splitstand.roller", { foot_L: 0.04, foot_R: 0.04, shank_L: 0.03, shank_R: 0.03 });
            goals.push(pin(body, `toe_${rearSide}`, () => new Vector3(sr * stanceX, rearY + 0.055, st.split!.rearZ), 34));
          } else if (rearMode === "elevated-bench") {
            const b = flatBench({ topY: rearY, zHead: st.split.rearZ - 0.5, zFoot: st.split.rearZ + 0.14 });
            staticParts.push(...b);
            addContacts("bench.pad", { foot_L: 0.04, foot_R: 0.04, shank_L: 0.03, shank_R: 0.03 });
            goals.push(pin(body, `toe_${rearSide}`, () => new Vector3(sr * stanceX, rearY, st.split!.rearZ), 34));
          } else if (rearMode === "flat") {
            goals.push(...plantFoot(body, rearSide, new Vector3(sr * stanceX, rearY, st.split.rearZ), toeOut));
            required.push({ label: "Rear heel planted", anchor: `heel_${rearSide}`, surfaceY: rearY });
          } else {
            goals.push(...plantToe(body, rearSide, new Vector3(sr * stanceX, rearY, st.split.rearZ), 0));
            required.push({ label: "Rear forefoot planted", anchor: `ballIn_${rearSide}`, surfaceY: rearY });
          }
          support = { ...support, feet: rearMode.startsWith("elevated") ? [frontSide] : SIDES };
          ground = config.ground ?? `heel_${frontSide}`;
        } else {
          goals.push(...plantBothFeet(body, stanceX, heelZ, toeOut, surfY));
          required.push(
            { label: "Left heel planted", anchor: "heel_L", surfaceY: surfY },
            { label: "Right heel planted", anchor: "heel_R", surfaceY: surfY },
            { label: "Left forefoot planted", anchor: "ballIn_L", surfaceY: surfY },
            { label: "Right forefoot planted", anchor: "ballIn_R", surfaceY: surfY },
          );
          ground = config.ground ?? "heel_L";
        }
        if (st.trackKnees) {
          const trackedSides = st.singleFoot ? [st.singleFoot] : SIDES;
          for (const side of trackedSides) goals.push(kneeOverToes(body, side, st.trackKnees));
        }
        if (st.torsoLeanDeg !== undefined) {
          goals.push(lockTorsoPitch(body, st.torsoLeanDeg, 26));
        }
      } else if (st.kind === "seated") {
        const seatY = st.seatY ?? 0.43;
        const seatZ = st.seatZ ?? -0.02;
        const stanceX = st.stanceX ?? 0.16;
        const heelZ = st.heelZ ?? 0.34;
        const toeOut = rad(st.toeOutDeg ?? 10);
        const frame = st.frame ?? { type: "flat-bench" };
        let passive = st.passiveJoints ?? ["hip", "knee", "ankle"];

        if (frame.type === "flat-bench") {
          const parts = flatBench({ topY: seatY, zHead: frame.zHead ?? -0.55, zFoot: frame.zFoot ?? 0.35 });
          staticParts.push(...parts);
          addPartObstacles(parts, ["bench.pad"]);
          goals.push(...sitOnSeat(body, seatY, seatZ, 0.01, 48));
          required.push({ label: "Seated on bench", anchor: "pelvisBottom", surfaceY: seatY - 0.01 });
        } else if (frame.type === "adjustable-bench") {
          const ab = adjustableBench({
            backAngleDeg: frame.backAngleDeg,
            seatY,
            seatTiltDeg: frame.seatTiltDeg,
            hingeZ: frame.hingeZ ?? -0.06,
            ankleRollers: frame.ankleRollers,
          });
          staticParts.push(...ab.parts);
          addPartObstacles(ab.parts, ["bench.seatPad", "bench.backPad"]);
          goals.push(...sitOnSeat(body, seatY, seatZ, 0.01, 55));
          if (st.pinBack !== false) {
            goals.push(
              ...restBackOnPad(body, ab.back, {
                sacrumAlong: null,
                occiputAlong: st.pinHead === false ? null : 0.72,
              }),
            );
            passive = st.passiveJoints ?? ["lumbar", "thoracic", "neck", "hip", "knee", "ankle"];
          }
          required.push({ label: "Seated on bench", anchor: "pelvisBottom", part: "bench.seatPad", allowSlide: true });
        } else if (frame.type === "machine") {
          const m = seatedMachineFrame({
            seatY,
            backAngleDeg: frame.backAngleDeg ?? 85,
            chestPadZ: frame.chestPadZ,
            chestPadY: frame.chestPadY,
            stackZ: frame.stackZ,
          });
          staticParts.push(...m.parts);
          addPartObstacles(m.parts, ["machine.seat", "machine.backPad", "machine.chestPad"]);
          goals.push(...sitOnSeat(body, seatY, seatZ, 0.01, 55));
          if (m.back && st.pinBack !== false) {
            goals.push(...restBackOnPad(body, m.back, { sacrumAlong: null, occiputAlong: null, upperBackAlong: 0.42 }));
            passive = st.passiveJoints ?? ["lumbar", "thoracic", "neck", "hip", "knee", "ankle"];
          }
          if (frame.chestPadZ !== undefined) {
            goals.push(pin(body, "sternum", () => new Vector3(0, frame.chestPadY ?? 0.94, frame.chestPadZ! - 0.02), 36, "z"));
            passive = st.passiveJoints ?? ["lumbar", "thoracic", "hip", "knee", "ankle"];
          }
          required.push({ label: "Seated on pad", anchor: "pelvisBottom", surfaceY: seatY - 0.01 });
        } else if (frame.type === "lat-pulldown") {
          const m = latPulldownMachine({
            seatY,
            thighPadY: frame.thighPadY ?? 0.61,
            pulleyZ: frame.pulleyZ ?? 0.14,
            columnZ: frame.columnZ ?? 1.05,
          });
          stationPulley = m.pulley;
          staticParts.push(...m.parts);
          addPartObstacles(m.parts, ["lat.seatPad", "lat.thighPad"]);
          goals.push(...sitOnSeat(body, seatY, seatZ, 0.01, 55));
          required.push({ label: "Seated on pad", anchor: "pelvisBottom", surfaceY: seatY - 0.01 });
        } else if (frame.type === "seated-row") {
          const m = seatedRowMachine({
            seatY,
            pulleyY: frame.pulleyY ?? 0.56,
            pulleyZ: frame.pulleyZ ?? 1.25,
          });
          stationPulley = m.pulley;
          staticParts.push(...m.parts);
          addPartObstacles(m.parts, ["row.seatPad", "row.footPlate"]);
          goals.push(...sitOnSeat(body, seatY, seatZ, 0.01, 55));
          required.push({ label: "Seated on bench", anchor: "pelvisBottom", surfaceY: seatY - 0.01 });
        } else if (frame.type === "preacher") {
          const m = preacherBench({ seatY, padTopY: frame.padTopY, padTopZ: frame.padTopZ });
          staticParts.push(...m.parts);
          addPartObstacles(m.parts, ["preacher.seat", "preacher.armPad"]);
          goals.push(...sitOnSeat(body, seatY, -0.05, 0.01, 55));
          const pSpot = pointOnPad(m.armPad, -0.22, 0.008);
          for (const side of SIDES) {
            const s = sideSign(side);
            goals.push(pin(body, `elbowTip_${side}`, () => new Vector3(s * 0.16, pSpot.y, pSpot.z), 30));
          }
          required.push({ label: "Seated on preacher bench", anchor: "pelvisBottom", surfaceY: seatY - 0.01 });
          passive = st.passiveJoints ?? ["hip", "knee", "ankle", "lumbar", "thoracic"];
        } else if (frame.type === "leg-extension") {
          const legSeatY = st.seatY ?? 0.56;
          const legSeatZ = st.seatZ ?? -0.04;
          const m = legExtensionMachine({
            seatY: legSeatY,
            backAngleDeg: frame.backAngleDeg ?? 78,
            thighRollerY: frame.thighRollerY,
          });
          staticParts.push(...m.parts);
          addContacts("legext.handleL", { hand_L: 0.06, forearm_L: 0.035 });
          addContacts("legext.handleR", { hand_R: 0.06, forearm_R: 0.035 });
          addPartObstacles(m.parts, ["legext.seat", "legext.backPad", "legext.thighRoller"]);
          goals.push(...sitOnSeat(body, legSeatY, legSeatZ, 0.01, 65));
          if (st.pinBack !== false) {
            goals.push(...restBackOnPad(body, m.back, { sacrumAlong: null, occiputAlong: null, upperBackAlong: 0.42 }));
          }
          if (st.pinHandles !== false) {
            const hL = new Vector3(...m.handleL);
            const hR = new Vector3(...m.handleR);
            goals.push(
              pin(body, "grip_L", () => hL, 32),
              pin(body, "grip_R", () => hR, 32),
              aim(body, "wrist_L", Z_AXIS, Z_AXIS, 4),
              aim(body, "wrist_R", Z_AXIS, Z_AXIS, 4),
            );
          }
          required.push({ label: "Seated on machine", anchor: "pelvisBottom", surfaceY: legSeatY - 0.01 });
          passive = st.passiveJoints ?? [
            "lumbar",
            "thoracic",
            "neck",
            "clavicle",
            "shoulder",
            "elbow",
            "forearm",
            "wrist",
            "hip",
            "ankle",
          ];
        } else {
          const h = frame.height ?? seatY;
          const bp = platformBox("seat.box", [0, 0, seatZ], 0.48, h, 0.48, "wood");
          staticParts.push(...bp);
          addPartObstacles(bp, ["seat.box"]);
          goals.push(...sitOnSeat(body, h, seatZ, 0.01, 55));
          required.push({ label: "Seated on box", anchor: "pelvisBottom", surfaceY: h - 0.01 });
        }

        if (st.lockHipFlexDeg !== undefined) {
          goals.push(
            lockAngle(body, "hip_L.flex", st.lockHipFlexDeg, 32),
            lockAngle(body, "hip_R.flex", st.lockHipFlexDeg, 32),
          );
        }

        if (st.leanDeg !== undefined) {
          goals.push(lockTorsoPitch(body, st.leanDeg, 32));
        }
        const feetMode = st.feetMode ?? (frame.type === "leg-extension" ? "hanging" : frame.type === "seated-row" ? "footplate" : "floor");
        if (feetMode === "floor") {
          goals.push(...plantBothFeet(body, stanceX, heelZ, toeOut, 0));
          required.push(
            { label: "Left heel on floor", anchor: "heel_L", surfaceY: 0 },
            { label: "Right heel on floor", anchor: "heel_R", surfaceY: 0 },
          );
        } else if (feetMode === "footplate") {
          const fz = frame.type === "seated-row" ? (frame.pulleyZ ?? 1.25) - 0.2 : 0.92;
          for (const side of SIDES) {
            const s = sideSign(side);
            goals.push(pin(body, `ballIn_${side}`, () => new Vector3(s * 0.14, 0.36, fz), 32));
            goals.push(pin(body, `heel_${side}`, () => new Vector3(s * 0.14, 0.24, fz - 0.06), 24));
          }
        }
        support = { kind: "seated", passive, brace: config.brace ?? true };
        ground = config.ground ?? "pelvisBottom";
      } else if (st.kind === "lying") {
        const topY = st.benchTopY ?? (st.surface === "floor" ? 0.016 : 0.44);
        const stanceX = st.stanceX ?? 0.22;
        const heelZ = st.heelZ ?? 0.42;
        const passive =
          st.passiveJoints ??
          (st.face === "down"
            ? ["hip", "knee", "ankle"]
            : ["lumbar", "thoracic", "neck", "hip", "knee", "ankle", "clavicle"]);
        if (st.surface === "flat-bench") {
          const parts = flatBench({ topY, zHead: -0.92, zFoot: 0.16 });
          staticParts.push(...parts);
          addPartObstacles(parts, ["bench.pad"]);
          if (st.face === "up") {
            goals.push(
              pin(body, "sacrum", () => new Vector3(0, topY - 0.008, 0), 42),
              pin(body, "upperBack", () => new Vector3(0, topY - 0.008, 0), 40, "xy"),
              pin(body, "occiput", () => new Vector3(0, topY - 0.008, 0), 22, "xy"),
            );
            required.push(
              { label: "Buttocks on bench", anchor: "sacrum", surfaceY: topY - 0.008 },
              { label: "Upper back on bench", anchor: "upperBack", surfaceY: topY - 0.008 },
            );
          } else if (st.face === "down") {
            goals.push(
              pin(body, "pelvisFront", () => new Vector3(0, topY - 0.008, -0.15), 40),
              pin(body, "chestFront", () => new Vector3(0, topY - 0.008, -0.58), 38, "xy"),
            );
            required.push({ label: "Chest supported on bench", anchor: "chestFront", surfaceY: topY - 0.008 });
          }
          if (st.feetOnFloor !== false) {
            goals.push(...plantBothFeet(body, stanceX, heelZ, 0.22, 0));
            required.push(
              { label: "Left foot on floor", anchor: "heel_L", surfaceY: 0 },
              { label: "Right foot on floor", anchor: "heel_R", surfaceY: 0 },
            );
          }
          if (st.rack) benchRackOpts = st.rack;
          if (st.smith) {
            smithRail = true;
            staticParts.push(...smithMachine({ stopY: st.smith.stopY ?? 0.62 }));
          }
        } else if (st.surface === "adjustable-bench") {
          const ab = adjustableBench({
            backAngleDeg: st.backAngleDeg ?? 30,
            seatY: topY,
            ankleRollers: st.ankleRollers,
          });
          staticParts.push(...ab.parts);
          addPartObstacles(ab.parts, ["bench.seatPad", "bench.backPad"]);
          if (st.face === "up") {
            goals.push(...restBackOnPad(body, ab.back, { occiputAlong: 0.72 }));
            required.push({ label: "Back on bench pad", anchor: "upperBack", part: "bench.backPad", allowSlide: true });
          } else {
            const chestPt = pointOnPad(ab.back, 0.46, 0.01);
            const hipPt = pointOnPad(ab.back, 0.1, 0.01);
            goals.push(
              pin(body, "chestFront", () => chestPt, 38),
              pin(body, "pelvisFront", () => hipPt, 36),
            );
            required.push({ label: "Chest on incline pad", anchor: "chestFront", part: "bench.backPad", allowSlide: true });
          }
          if (st.feetOnFloor !== false && !st.ankleRollers) {
            goals.push(...plantBothFeet(body, stanceX, heelZ, 0.22, 0));
          }
          if (st.rack) benchRackOpts = st.rack;
          if (st.smith) {
            smithRail = true;
            staticParts.push(...smithMachine({ stopY: st.smith.stopY ?? 0.72 }));
          }
        } else if (st.surface === "lying-leg-curl") {
          const m = lyingLegCurlMachine();
          staticParts.push(...m.parts);
          addContacts("legcurl.handle", HAND_ALLOW);
          addPartObstacles(m.parts, ["legcurl.chestPad", "legcurl.thighPad"]);
          goals.push(
            pin(body, "pelvisFront", () => new Vector3(0, m.hipY - 0.01, -0.02), 40),
            pin(body, "chestFront", () => new Vector3(0, m.hipY - 0.04, 0.42), 36, "xy"),
            pin(body, "grip_L", () => new Vector3(0.24, m.hipY - 0.16, 0.72), 26),
            pin(body, "grip_R", () => new Vector3(-0.24, m.hipY - 0.16, 0.72), 26),
          );
          required.push({ label: "Hips on curl bench", anchor: "pelvisFront", surfaceY: m.hipY - 0.01, allowSlide: true });
        } else if (st.surface === "stability-ball") {
          const bp = stabilityBall(0.32, [0, -0.35]);
          staticParts.push(...bp);
          addPartObstacles(bp, ["ball.body"]);
          goals.push(pin(body, "upperBack", () => new Vector3(0, 0.62, -0.35), 36));
          if (st.feetOnFloor !== false) goals.push(...plantBothFeet(body, 0.2, 0.42, 0.15, 0));
        } else {
          // floor
          staticParts.push(...exerciseMat());
          if (st.face === "up") {
            goals.push(pin(body, "sacrum", () => new Vector3(0, 0.025, 0), 40, "xy"));
            goals.push(keepAbove(body, "upperBack", 0.02, 35));
            goals.push(keepAbove(body, "occiput", 0.02, 30));
          } else if (st.face === "down") {
            goals.push(pin(body, "pelvisFront", () => new Vector3(0, 0.03, 0), 36, "xy"));
            goals.push(keepAbove(body, "chestFront", 0.02, 30));
          } else {
            goals.push(pin(body, "pelvisBottom", () => new Vector3(0, 0.1, 0), 30, "y"));
          }
          if (st.feetOnFloor) {
            goals.push(...plantBothFeet(body, stanceX, heelZ, 0.15, 0));
          }
        }
        support = { kind: "lying", rail: smithRail || undefined, passive, brace: config.brace ?? true };
        ground = config.ground ?? (st.face === "down" ? "pelvisFront" : "sacrum");
      } else if (st.kind === "kneeling") {
        const surfY = st.surfaceY ?? 0.016;
        if (st.mat !== false) staticParts.push(...exerciseMat(0.7, 1.3, 0));
        if (st.halfKneelingSide) {
          const front = st.halfKneelingSide;
          const back: Side = front === "L" ? "R" : "L";
          goals.push(...plantFoot(body, front, new Vector3(sideSign(front) * 0.16, 0, 0.36), 0.1));
          goals.push(pin(body, `kneeFront_${back}`, () => new Vector3(sideSign(back) * 0.14, surfY + 0.04, -0.14), 40));
          goals.push(...plantToe(body, back, new Vector3(sideSign(back) * 0.14, 0, -0.56), 0));
          required.push({ label: "Front foot planted", anchor: `heel_${front}`, surfaceY: 0 });
          ground = config.ground ?? `heel_${front}`;
        } else {
          for (const side of SIDES) {
            const s = sideSign(side);
            goals.push(pin(body, `kneeFront_${side}`, () => new Vector3(s * 0.14, surfY + 0.04, 0.02), 40));
            goals.push(...plantToe(body, side, new Vector3(s * 0.14, 0, -0.4), 0));
          }
          required.push(
            { label: "Left knee on mat", anchor: "kneeFront_L", surfaceY: surfY + 0.04, allowSlide: true },
            { label: "Right knee on mat", anchor: "kneeFront_R", surfaceY: surfY + 0.04, allowSlide: true },
          );
          ground = config.ground ?? "kneeFront_L";
        }
        if (st.leanDeg !== undefined) goals.push(lockTorsoPitch(body, st.leanDeg, 24));
        support = { kind: "supported", passive: ["knee", "ankle"], brace: config.brace ?? true };
      } else if (st.kind === "hanging") {
        const barY = st.barY ?? 2.25;
        const barZ = st.barZ ?? 0;
        const station = pullUpStation(barY, barZ, st.width ?? 1.2);
        staticParts.push(...station.parts);
        addContacts("pullup.bar", HAND_ALLOW);
        const gripX = 0.28;
        for (const side of SIDES) {
          const s = sideSign(side);
          goals.push(pin(body, `grip_${side}`, () => new Vector3(s * gripX, barY, barZ), 48));
        }
        required.push(
          { label: "Left hand on bar", anchor: "grip_L", part: "pullup.bar", allowSlide: true },
          { label: "Right hand on bar", anchor: "grip_R", part: "pullup.bar", allowSlide: true },
        );
        support = { kind: "hanging", passive: ["hip", "knee", "ankle"], brace: config.brace ?? true };
        ground = config.ground ?? "grip_L";
      } else if (st.kind === "dip") {
        const barY = st.barY ?? 1.28;
        const station = dipStation(barY, st.spacing ?? 0.56, st.z ?? 0);
        staticParts.push(...station.parts);
        addContacts("dip.bar", HAND_ALLOW);
        for (const side of SIDES) {
          const s = sideSign(side);
          goals.push(pin(body, `press_${side}`, () => new Vector3(s * station.barX, barY + 0.015, st.z ?? 0), 48));
          required.push({
            label: `${side === "L" ? "Left" : "Right"} hand on dip bar`,
            anchor: `press_${side}`,
            part: `dip.bar_${side}`,
            allowSlide: true,
          });
        }
        support = { kind: "supported", passive: ["hip", "knee", "ankle"], brace: config.brace ?? true };
        ground = config.ground ?? "press_L";
      } else if (st.kind === "pushup") {
        const handX = st.handX ?? 0.28;
        const handZ = st.handZ ?? 0.42;
        const handY = st.handElevationY ?? 0.016;
        const footY = st.feetElevationY ?? 0;
        const footZ = st.footZ ?? -0.88;
        const footX = st.footX ?? 0.11;
        staticParts.push(...exerciseMat(0.8, 1.9, -0.2));
        if (st.handElevationY && st.handElevationY > 0.05) {
          const bp = platformBox("pushup.handBox", [0, 0, handZ], 0.8, st.handElevationY, 0.36, "pad");
          staticParts.push(...bp);
          addContacts("pushup.handBox", HAND_ALLOW);
        }
        if (st.feetElevationY && st.feetElevationY > 0.05) {
          const bp = platformBox("pushup.footBox", [0, 0, footZ], 0.6, st.feetElevationY, 0.36, "pad");
          staticParts.push(...bp);
          addContacts("pushup.footBox", { foot_L: 0.04, foot_R: 0.04 });
        }
        const handAnchor = st.forearmsOnFloor ? "forearmMid" : "palmFlat";
        for (const side of SIDES) {
          const s = sideSign(side);
          goals.push(pin(body, `${handAnchor}_${side}`, () => new Vector3(s * handX, handY, handZ), 44));
          required.push({
            label: `${side === "L" ? "Left" : "Right"} ${st.forearmsOnFloor ? "forearm" : "hand"} grounded`,
            anchor: `${handAnchor}_${side}`,
            surfaceY: handY,
            allowSlide: true,
          });
        }
        if (st.kneesOnFloor) {
          for (const side of SIDES) {
            const s = sideSign(side);
            goals.push(pin(body, `kneeFront_${side}`, () => new Vector3(s * 0.14, 0.04, -0.42), 40));
          }
          ground = config.ground ?? "kneeFront_L";
        } else {
          goals.push(...plantBothToes(body, footX, footZ, footY, 44));
          required.push(
            { label: "Left forefoot grounded", anchor: "ballIn_L", surfaceY: footY, allowSlide: true },
            { label: "Right forefoot grounded", anchor: "ballIn_R", surfaceY: footY, allowSlide: true },
          );
          ground = config.ground ?? "ballIn_L";
        }
        support = { kind: "supported", passive: ["knee", "ankle"], brace: config.brace ?? true };
      } else if (st.kind === "leg-press") {
        const frame = legPressFrame({ angleDeg: st.angleDeg ?? 45 });
        legPressRailDir = frame.railDir;
        staticParts.push(...frame.parts);
        addContacts("legpress.handle", HAND_ALLOW);
        addPartObstacles(frame.parts, ["legpress.seatPad", "legpress.backPad"]);
        goals.push(...restBackOnPad(body, frame.back, { occiputAlong: 0.72, sacrumAlong: 0.06 }));
        goals.push(pin(body, "grip_L", () => new Vector3(0.32, 0.44, 0.04), 22));
        goals.push(pin(body, "grip_R", () => new Vector3(-0.32, 0.44, 0.04), 22));
        required.push({ label: "Back on sled backrest", anchor: "upperBack", part: "legpress.backPad", allowSlide: true });
        support = {
          kind: "lying",
          passive: ["lumbar", "thoracic", "neck", "clavicle", "shoulder", "elbow", "forearm", "wrist"],
          brace: config.brace ?? true,
        };
        ground = config.ground ?? "sacrum";
      } else if (st.kind === "hack-squat") {
        const m = hackSquatMachine({ angleDeg: st.angleDeg ?? 45 });
        staticParts.push(...m.parts);
        addContacts("hack.footPlate", { foot_L: 0.03, foot_R: 0.03 });
        const sx = st.stanceX ?? 0.18;
        for (const side of SIDES) {
          const s = sideSign(side);
          goals.push(pin(body, `heel_${side}`, () => new Vector3(s * sx, 0.16, 0.44), 38));
          goals.push(pin(body, `ballIn_${side}`, () => new Vector3(s * sx, 0.24, 0.62), 38));
        }
        support = { kind: "standing", rail: true, passive: ["shoulder", "elbow", "forearm", "wrist"], brace: config.brace ?? true };
        ground = config.ground ?? "heel_L";
      } else if (st.kind === "roman-chair" || st.kind === "ghd") {
        const m = st.kind === "roman-chair" ? romanChair({ padY: st.padY }) : ghdBench({ padY: st.padY });
        staticParts.push(...m.parts);
        addPartObstacles(m.parts, ["roman.hipPad", "roman.ankleRoller", "ghd.pad", "ghd.roller"]);
        goals.push(pin(body, "pelvisFront", () => new Vector3(0, m.padY, 0.04), 40));
        for (const side of SIDES) {
          const s = sideSign(side);
          goals.push(
            pin(
              body,
              `heel_${side}`,
              () => new Vector3(s * 0.12, st.kind === "roman-chair" ? 0.24 : 0.66, m.footZ + 0.06),
              36,
            ),
          );
        }
        required.push({ label: "Hips braced on pad", anchor: "pelvisFront", surfaceY: m.padY, allowSlide: true });
        support = { kind: "supported", passive: ["knee", "ankle"], brace: config.brace ?? true };
        ground = config.ground ?? "pelvisFront";
      } else if (st.kind === "hip-thrust") {
        const benchY = st.benchTopY ?? 0.44;
        const bp = flatBench({ topY: benchY, zHead: -0.68, zFoot: -0.22, width: 0.72 });
        staticParts.push(...bp);
        addPartObstacles(bp, ["bench.pad"]);
        goals.push(pin(body, "upperBack", () => new Vector3(0, benchY - 0.01, -0.24), 40, "xy"));
        goals.push(pin(body, "upperBack", () => new Vector3(0, benchY - 0.01, -0.24), 18, "z"));
        goals.push(...plantBothFeet(body, st.stanceX ?? 0.2, st.heelZ ?? 0.46, 0.16, 0));
        required.push(
          { label: "Upper back on bench edge", anchor: "upperBack", part: "bench.pad", allowSlide: true },
          { label: "Left heel on floor", anchor: "heel_L", surfaceY: 0 },
          { label: "Right heel on floor", anchor: "heel_R", surfaceY: 0 },
        );
        support = { kind: "supported", passive: ["lumbar", "thoracic", "neck", "clavicle", "shoulder", "elbow", "forearm", "wrist"], brace: config.brace ?? true };
        ground = config.ground ?? "heel_L";
      } else if (st.kind === "calf-station") {
        const m = calfRaiseStation({ mode: st.mode, blockY: st.blockY, seatY: st.seatY });
        staticParts.push(...m.parts);
        addPartObstacles(m.parts, ["calf.seat", "calf.block"]);
        const sx = st.stanceX ?? 0.14;
        const sides = st.singleFoot ? [st.singleFoot] : SIDES;
        for (const side of sides) {
          goals.push(...plantToe(body, side, new Vector3(sideSign(side) * sx, m.blockY, 0.16), 0));
          required.push({ label: `${side === "L" ? "Left" : "Right"} forefoot on block`, anchor: `ballIn_${side}`, surfaceY: m.blockY });
        }
        if (st.mode === "seated") {
          const sy = st.seatY ?? 0.48;
          goals.push(...sitOnSeat(body, sy, -0.34, 0.01, 48));
          support = { kind: "seated", passive: ["lumbar", "thoracic", "neck", "hip", "knee"], brace: config.brace ?? true };
          ground = config.ground ?? "pelvisBottom";
        } else {
          support = { kind: "standing", feet: sides, rail: true, brace: config.brace ?? true };
          ground = config.ground ?? `ballIn_${sides[0]}`;
        }
      } else if (st.kind === "cardio") {
        if (st.machine !== "none") {
          const parts = cardioMachine(st.machine);
          staticParts.push(...parts);
          addPartObstacles(parts, ["bike.seat", "rower.seat", "treadmill.deck", "stairs.step"]);
        }
        support = { kind: "supported", passive: ["clavicle", "wrist"], brace: config.brace ?? true };
        ground = config.ground ?? "pelvisBottom";
      }

      // 2. Apparatus (props, tethers, loads, hand-path extras, required contacts)
      const app = config.apparatus;
      const defaultSides: Side[] = laterality === "unilateral" ? [activeSide] : SIDES;

      if (app.kind === "none") {
        if (app.bodyweightLoads) {
          for (const bl of app.bodyweightLoads) {
            loads.push({
              anchor: bl.anchor,
              share: bl.share ?? 0,
              bodyweightShare: bl.bodyweightShare,
              grip: bl.grip ?? "press",
              direction: bl.direction,
            });
          }
        }
      } else if (app.kind === "barbell") {
        const barProp = makeBarProp(app.style);
        props.push(barProp);
        const handPrefix = app.anchor ?? (config.grip === "press" ? "press" : "grip");
        addContacts("bar", {
          ...HAND_ALLOW,
          chest: 0.03,
          girdle: 0.035,
          neck: 0.018,
          pelvis: 0.04,
          thigh_L: 0.03,
          thigh_R: 0.03,
          upperarm_L: 0.035,
          upperarm_R: 0.035,
        });
        if (app.path) {
          const barY = body.dofCount;
          const barZ = body.dofCount + 1;
          extras = 2;
          extraStart.push(app.path.startY, app.path.startZ);
          const t = new Vector3();
          for (const side of SIDES) {
            const s = sideSign(side);
            goals.push(pin(body, `${handPrefix}_${side}`, (q) => t.set(s * app.gripX, q[barY], q[barZ]), 42));
            if (app.alignWrists !== false) {
              goals.push(aim(body, `wrist_${side}`, Z_AXIS, new Vector3(-s, 0, 0), 3.5));
            }
          }
          keyStart.push(({ q, push }) => {
            push(38 * (q[barY] - app.path!.startY));
            push(38 * (q[barZ] - app.path!.startZ));
          });
          keyEnd.push(({ q, push }) => {
            push(38 * (q[barY] - app.path!.endY));
            push(38 * (q[barZ] - app.path!.endZ));
          });
          const bz = app.path.arcBulgeZ ?? 0;
          const by = app.path.arcBulgeY ?? 0;
          if (bz !== 0 || by !== 0) {
            pathFn = (s, a, b) => [
              a[0] + (b[0] - a[0]) * s + by * Math.sin(Math.PI * s) ** 2,
              a[1] + (b[1] - a[1]) * s + bz * Math.sin(Math.PI * s) ** 2,
            ];
          }
          propStateFn = (_frame, ex) => [{ pos: [0, ex[0], ex[1]], quat: IDENTITY }];
          if (benchRackOpts) {
            dynamicEquipmentFn = ({ start: sPose, end: ePose, startFrame }) => [
              ...staticParts,
              ...benchRack({
                z: anchorPoint(body, startFrame, "mouth").z,
                hookY: benchRackOpts!.hookY ?? sPose[barY] - 0.05 - BAR_RADIUS,
                safetyY: benchRackOpts!.safetyY ?? ePose[barY] - BAR_RADIUS - 0.025,
                safetyReach: 0.6,
              }),
            ];
          }
        } else {
          if (app.restAnchor) {
            if (app.restAnchor === "traps") {
              for (const side of SIDES) {
                const s = sideSign(side);
                const trap = new Vector3();
                goals.push(({ frame, push }) => {
                  anchorPoint(body, frame, "traps", trap);
                  const h = anchorPoint(body, frame, `${handPrefix}_${side}`);
                  push(28 * (h.x - s * app.gripX));
                  push(28 * (h.y - trap.y));
                  push(28 * (h.z - trap.z));
                });
              }
              propStateFn = (frame) => {
                const p = anchorPoint(body, frame, "traps");
                return [{ pos: [p.x, p.y, p.z], quat: IDENTITY }];
              };
            } else {
              goals.push(keepHandsOnBar(body, app.gripX, handPrefix, 24));
              propStateFn = (frame) => {
                const p = anchorPoint(body, frame, app.restAnchor!);
                return [{ pos: [p.x, p.y, p.z], quat: IDENTITY }];
              };
            }
          } else {
            goals.push(keepHandsOnBar(body, app.gripX, handPrefix, 26));
            if (app.alignWrists !== false) goals.push(...alignBarWrists(body, 3));
            propStateFn = (frame) => [
              barBetweenAnchors(body, frame, `${handPrefix}_L`, `${handPrefix}_R`),
            ];
          }
        }
        if (app.restAnchor) {
          loads.push({ anchor: app.restAnchor, share: 1, grip: "rest" });
          required.push({ label: "Bar seated on body", anchor: app.restAnchor, prop: "bar" });
        } else {
          for (const side of SIDES) {
            loads.push({
              anchor: `${handPrefix}_${side}`,
              share: 0.5,
              grip: handPrefix === "press" ? "press" : "hang",
            });
          }
        }
        for (const side of SIDES) {
          required.push({
            label: `${side === "L" ? "Left" : "Right"} hand on bar`,
            anchor: `${handPrefix}_${side}`,
            prop: "bar",
          });
        }
      } else if (app.kind === "dumbbells") {
        const sides = app.sides ?? defaultSides;
        const handPrefix = app.anchor ?? (config.grip === "press" ? "press" : "grip");
        for (const side of sides) {
          const id = `dumbbell_${side}`;
          props.push({ id, kind: "dumbbell", fatGrip: app.fatGrip });
          addContacts(id, { [`hand_${side}`]: 0.08, [`forearm_${side}`]: 0.03 });
          loads.push({
            anchor: `${handPrefix}_${side}`,
            share: config.loadUnit === "perSide" ? 1 : 1 / sides.length,
            grip: handPrefix === "press" ? "press" : "hang",
          });
          required.push({
            label: `${side === "L" ? "Left" : "Right"} hand on dumbbell`,
            anchor: `${handPrefix}_${side}`,
            prop: id,
          });
        }
        if (app.handPath) {
          const ix = body.dofCount;
          extras = 3;
          extraStart.push(...app.handPath.start);
          const t = new Vector3();
          for (const side of sides) {
            const s = sideSign(side);
            goals.push(
              pin(body, `${handPrefix}_${side}`, (q) => t.set(s * q[ix], q[ix + 1], q[ix + 2]), 40),
            );
          }
          keyStart.push(({ q, push }) => {
            push(36 * (q[ix] - app.handPath!.start[0]));
            push(36 * (q[ix + 1] - app.handPath!.start[1]));
            push(36 * (q[ix + 2] - app.handPath!.start[2]));
          });
          keyEnd.push(({ q, push }) => {
            push(36 * (q[ix] - app.handPath!.end[0]));
            push(36 * (q[ix + 1] - app.handPath!.end[1]));
            push(36 * (q[ix + 2] - app.handPath!.end[2]));
          });
          const b = app.handPath.arcBulge;
          if (b) {
            pathFn = (s, a, e) => {
              const bell = Math.sin(Math.PI * s) ** 2;
              return [
                a[0] + (e[0] - a[0]) * s + b[0] * bell,
                a[1] + (e[1] - a[1]) * s + b[1] * bell,
                a[2] + (e[2] - a[2]) * s + b[2] * bell,
              ];
            };
          }
        }
        propStateFn = (frame) => sides.map((side) => propAtGrip(body, frame, side, handPrefix));
      } else if (app.kind === "kettlebells") {
        const sides = app.sides ?? defaultSides;
        if (app.twoHandsOnOne) {
          props.push({ id: "kettlebell", kind: "kettlebell" });
          addContacts("kettlebell", HAND_ALLOW);
          goals.push(keepHandsOnBar(body, 0.06, "grip", 24));
          for (const side of SIDES) {
            loads.push({ anchor: `grip_${side}`, share: 0.5, grip: "hang" });
            required.push({ label: `${side === "L" ? "Left" : "Right"} hand on kettlebell`, anchor: `grip_${side}`, prop: "kettlebell" });
          }
          propStateFn = (frame) => [barBetweenAnchors(body, frame, "grip_L", "grip_R")];
        } else {
          for (const side of sides) {
            const id = `kettlebell_${side}`;
            props.push({ id, kind: "kettlebell" });
            addContacts(id, { [`hand_${side}`]: 0.08, [`forearm_${side}`]: 0.05 });
            loads.push({
              anchor: `grip_${side}`,
              share: config.loadUnit === "perSide" ? 1 : 1 / sides.length,
              grip: "hang",
            });
            required.push({ label: `${side === "L" ? "Left" : "Right"} hand on kettlebell`, anchor: `grip_${side}`, prop: id });
          }
          propStateFn = (frame) =>
            sides.map((side) => propAtGrip(body, frame, side, "grip", app.hangVertical ?? true));
        }
      } else if (app.kind === "plate" || app.kind === "medball") {
        const id = app.kind;
        const sides = app.sides ?? SIDES;
        props.push({ id, kind: app.kind });
        addContacts(id, { ...HAND_ALLOW, chest: 0.04, head: 0.03 });
        if (app.twoHandsOnOne !== false && sides.length === 2) {
          goals.push(keepHandsOnBar(body, app.kind === "medball" ? 0.14 : 0.16, "grip", 22));
          propStateFn = (frame) => [barBetweenAnchors(body, frame, "grip_L", "grip_R")];
        } else {
          propStateFn = (frame) => [propAtGrip(body, frame, sides[0], "grip")];
        }
        for (const side of sides) {
          loads.push({ anchor: `grip_${side}`, share: 1 / sides.length, grip: "hang" });
          required.push({ label: `${side === "L" ? "Left" : "Right"} hand on ${id}`, anchor: `grip_${side}`, prop: id });
        }
      } else if (app.kind === "cable-single") {
        let pulley = app.pulley;
        if (!app.skipColumn && !stationPulley) {
          const cx = app.columnPos ? app.columnPos[0] : pulley[0];
          const cz = app.columnPos ? app.columnPos[1] : pulley[2] + (app.facingDir === 1 ? -0.1 : 0.1);
          const col = cableColumn({
            x: cx,
            z: cz,
            pulleyY: pulley[1],
            facingDir: app.facingDir ?? -1,
          });
          staticParts.push(...col.parts);
          pulley = col.pulley;
        } else if (stationPulley) {
          pulley = stationPulley;
        }
        const sides = app.sides ?? defaultSides;
        const propId = "cableHandle";
        props.push(cableAttachmentProp(propId, app.attachment, app.attachmentWidth));
        addContacts(propId, {
          ...HAND_ALLOW,
          chest: 0.03,
          head: 0.03,
          shank_L: 0.04,
          shank_R: 0.04,
          foot_L: 0.04,
          foot_R: 0.04,
        });
        tethers.push({ id: "cable", kind: "cable", radius: 0.005 });

        if (app.anchor) {
          loads.push({ anchor: app.anchor, share: 1, grip: "rest", pulley });
          required.push({ label: "Cable attached", anchor: app.anchor, prop: propId });
          propStateFn = (frame) => {
            const p = anchorPoint(body, frame, app.anchor!);
            return [{ pos: [p.x, p.y, p.z], quat: IDENTITY }];
          };
        } else if (app.handPath && sides.length === 2) {
          const by = body.dofCount;
          const bz = body.dofCount + 1;
          extras = 2;
          extraStart.push(app.handPath.startY, app.handPath.startZ);
          const gx = app.gripX ?? 0.24;
          const t = new Vector3();
          for (const side of SIDES) {
            const s = sideSign(side);
            goals.push(pin(body, `grip_${side}`, (q) => t.set(s * gx, q[by], q[bz]), 42));
            loads.push({ anchor: `grip_${side}`, share: 0.5, grip: "hang", pulley });
            required.push({ label: `${side === "L" ? "Left" : "Right"} hand on attachment`, anchor: `grip_${side}`, prop: propId });
          }
          keyStart.push(({ q, push }) => {
            push(38 * (q[by] - app.handPath!.startY));
            push(38 * (q[bz] - app.handPath!.startZ));
          });
          keyEnd.push(({ q, push }) => {
            push(38 * (q[by] - app.handPath!.endY));
            push(38 * (q[bz] - app.handPath!.endZ));
          });
          if (app.handPath.arcBulgeZ) {
            const bulge = app.handPath.arcBulgeZ;
            pathFn = (s, a, e) => [
              a[0] + (e[0] - a[0]) * s,
              a[1] + (e[1] - a[1]) * s + bulge * Math.sin(Math.PI * s) ** 2,
            ];
          }
          propStateFn = (_frame, ex) => [{ pos: [0, ex[0], ex[1]], quat: IDENTITY }];
        } else if (sides.length === 2) {
          const gx = app.gripX ?? (app.twoHandsOnOne ? 0.05 : app.attachment === "lat-bar" ? 0.34 : 0.16);
          if (!app.twoHandsOnOne) {
            goals.push(keepHandsOnBar(body, gx, "grip", 24));
          } else {
            const pL = new Vector3();
            const pR = new Vector3();
            const aL = body.anchors.grip_L;
            const aR = body.anchors.grip_R;
            goals.push(({ frame, push }) => {
              worldPoint(frame, aL.joint, aL.local, pL);
              worldPoint(frame, aR.joint, aR.local, pR);
              push(28 * (pL.x - pR.x - 0.04));
              push(28 * (pL.y - pR.y));
              push(28 * (pL.z - pR.z));
            });
          }
          for (const side of SIDES) {
            loads.push({ anchor: `grip_${side}`, share: 0.5, grip: "hang", pulley });
            required.push({ label: `${side === "L" ? "Left" : "Right"} hand on attachment`, anchor: `grip_${side}`, prop: propId });
          }
          propStateFn = (frame) => [barBetweenAnchors(body, frame, "grip_L", "grip_R")];
        } else {
          const side = sides[0];
          loads.push({ anchor: `grip_${side}`, share: 1, grip: "hang", pulley });
          required.push({ label: `${side === "L" ? "Left" : "Right"} hand on handle`, anchor: `grip_${side}`, prop: propId });
          propStateFn = (frame) => [propAtGrip(body, frame, side, "grip")];
        }
        tetherStateFn = (_frame, _ex, propStates) => [{ points: [pulley, propStates[0].pos] }];
      } else if (app.kind === "cable-dual") {
        const xo = cableCrossover({
          pulleyY: app.pulleyY,
          halfWidth: app.halfWidth ?? 1.05,
          z: app.z ?? 0,
        });
        staticParts.push(...xo.parts);
        const sides = app.sides ?? defaultSides;
        const anchorKind = app.anchor ?? "grip";
        const att = app.attachment ?? "d-handle";
        for (const side of sides) {
          const id = `handle_${side}`;
          const pulley = side === "L" ? xo.pulleyL : xo.pulleyR;
          props.push(cableAttachmentProp(id, att));
          addContacts(id, { ...HAND_ALLOW, shank_L: 0.04, shank_R: 0.04 });
          tethers.push({ id: `cable_${side}`, kind: "cable", radius: 0.005 });
          loads.push({
            anchor: `${anchorKind}_${side}`,
            share: config.loadUnit === "perSide" ? 1 : 1 / sides.length,
            grip: anchorKind === "ankleCuff" ? "rest" : anchorKind === "press" ? "press" : "hang",
            pulley,
          });
          required.push({
            label: `${side === "L" ? "Left" : "Right"} contact on cable handle`,
            anchor: `${anchorKind}_${side}`,
            prop: id,
          });
        }
        propStateFn = (frame) =>
          sides.map((side) =>
            anchorKind === "ankleCuff"
              ? { pos: anchorPoint(body, frame, `ankleCuff_${side}`).toArray() as Vec3, quat: IDENTITY }
              : propAtGrip(body, frame, side, anchorKind),
          );
        tetherStateFn = (_frame, _ex, propStates) =>
          sides.map((side, i) => ({
            points: [side === "L" ? xo.pulleyL : xo.pulleyR, propStates[i].pos],
          }));
      } else if (app.kind === "band") {
        const sides = app.sides ?? defaultSides;
        const targetAnchors = app.targetAnchors ?? sides.map((s) => `grip_${s}`);
        targetAnchors.forEach((anchor, i) => {
          const anchorPt = app.anchors[Math.min(i, app.anchors.length - 1)];
          tethers.push({ id: `band_${i}`, kind: "band", radius: 0.01 });
          loads.push({
            anchor,
            share: 1 / targetAnchors.length,
            grip: anchor.startsWith("grip") ? "hang" : "rest",
            pulley: anchorPt,
          });
        });
        tetherStateFn = (frame) =>
          targetAnchors.map((anchor, i) => ({
            points: [
              app.anchors[Math.min(i, app.anchors.length - 1)],
              anchorPoint(body, frame, anchor).toArray() as Vec3,
            ],
          }));
      } else if (app.kind === "machine-handles") {
        const sides = app.sides ?? defaultSides;
        const anchorKind = app.anchor ?? (config.grip === "press" ? "press" : "grip");
        for (const side of sides) {
          const id = `handle_${side}`;
          props.push(machineHandleProp(id, app.orientation ?? "horizontal"));
          addContacts(id, HAND_ALLOW);
          loads.push({
            anchor: `${anchorKind}_${side}`,
            share: config.loadUnit === "perSide" ? 1 : 1 / sides.length,
            grip: anchorKind === "press" ? "press" : "hang",
            direction: app.forceDir,
          });
          required.push({
            label: `${side === "L" ? "Left" : "Right"} hand on machine handle`,
            anchor: `${anchorKind}_${side}`,
            prop: id,
          });
        }
        if (app.handPath) {
          const ix = body.dofCount;
          extras = 3;
          extraStart.push(...app.handPath.start);
          const t = new Vector3();
          for (const side of sides) {
            const s = sideSign(side);
            goals.push(
              pin(body, `${anchorKind}_${side}`, (q) => t.set(s * q[ix], q[ix + 1], q[ix + 2]), 40),
            );
          }
          keyStart.push(({ q, push }) => {
            push(36 * (q[ix] - app.handPath!.start[0]));
            push(36 * (q[ix + 1] - app.handPath!.start[1]));
            push(36 * (q[ix + 2] - app.handPath!.start[2]));
          });
          keyEnd.push(({ q, push }) => {
            push(36 * (q[ix] - app.handPath!.end[0]));
            push(36 * (q[ix + 1] - app.handPath!.end[1]));
            push(36 * (q[ix + 2] - app.handPath!.end[2]));
          });
          const b = app.handPath.arcBulge;
          if (b) {
            pathFn = (s, a, e) => {
              const bell = Math.sin(Math.PI * s) ** 2;
              return [
                a[0] + (e[0] - a[0]) * s + b[0] * bell,
                a[1] + (e[1] - a[1]) * s + b[1] * bell,
                a[2] + (e[2] - a[2]) * s + b[2] * bell,
              ];
            };
          }
        }
        propStateFn = (frame) =>
          sides.map((side) => {
            const pt = anchorPoint(body, frame, `${anchorKind}_${side}`);
            return { pos: [pt.x, pt.y, pt.z], quat: IDENTITY };
          });
      } else if (app.kind === "roller-pad") {
        props.push(rollerPadProp("roller", app.width ?? 0.44, app.radius ?? 0.055));
        addContacts("roller", {
          ...PAD_RESTING,
          foot_L: 0.04,
          foot_R: 0.04,
        });
        for (const a of app.trackAnchors) {
          loads.push({
            anchor: a,
            share: 1 / app.trackAnchors.length,
            grip: "rest",
            pulley: app.pulley,
            direction: app.forceDir,
          });
          required.push({ label: "Roller pad contact", anchor: a, prop: "roller" });
        }
        propStateFn = (frame) => [
          rollerOnAnchors(body, frame, app.trackAnchors, app.offset ?? [0, 0, 0], app.localOffset),
        ];
      } else if (app.kind === "landmine") {
        const lm = landmineBase(app.pivotZ ?? 1.65);
        staticParts.push(...lm.parts);
        props.push(olympicBar("bar"));
        addContacts("bar", { ...HAND_ALLOW, chest: 0.03 });
        const sides = app.sides ?? defaultSides;
        for (const side of sides) {
          loads.push({ anchor: `grip_${side}`, share: 1 / sides.length, grip: "press" });
          required.push({ label: `${side === "L" ? "Left" : "Right"} hand on bar end`, anchor: `grip_${side}`, prop: "bar" });
        }
        const pivot = new Vector3(...lm.pivot);
        propStateFn = (frame) => {
          const hand =
            sides.length === 2
              ? anchorPoint(body, frame, "grip_L").add(anchorPoint(body, frame, "grip_R")).multiplyScalar(0.5)
              : anchorPoint(body, frame, `grip_${sides[0]}`);
          const dir = hand.clone().sub(pivot).normalize();
          const barCenter = pivot.clone().addScaledVector(dir, 1.05);
          return [{ pos: [barCenter.x, barCenter.y, barCenter.z], quat: quatFromAxisX(dir, Y_AXIS) }];
        };
      } else if (app.kind === "ab-wheel") {
        props.push(abWheelProp("abwheel"));
        addContacts("abwheel", HAND_ALLOW);
        goals.push(keepHandsOnBar(body, 0.13, "grip", 28));
        for (const side of SIDES) {
          goals.push(pin(body, `grip_${side}`, () => new Vector3(sideSign(side) * 0.13, 0.1, 0), 42, "y"));
          loads.push({ anchor: `grip_${side}`, share: 0, bodyweightShare: 0.25, grip: "press", direction: [0, 1, 0] });
          required.push({ label: `${side === "L" ? "Left" : "Right"} hand on ab wheel`, anchor: `grip_${side}`, prop: "abwheel" });
        }
        propStateFn = (frame) => [barBetweenAnchors(body, frame, "grip_L", "grip_R")];
      } else if (app.kind === "rings") {
        const ay = app.anchorY ?? 2.35;
        const sp = (app.spacing ?? 0.56) / 2;
        staticParts.push(...pullUpStation(ay, 0, 1.3).parts);
        for (const side of SIDES) {
          props.push(gymRingProp(`ring_${side}`));
          addContacts(`ring_${side}`, HAND_ALLOW);
          tethers.push({ id: `strap_${side}`, kind: "cable", radius: 0.008 });
          loads.push({
            anchor: `grip_${side}`,
            share: 0.5,
            bodyweightShare: app.bodyweightShare ?? 0.5,
            grip: "hang",
            direction: [0, 1, 0],
          });
          required.push({ label: `${side === "L" ? "Left" : "Right"} hand on ring`, anchor: `grip_${side}`, prop: `ring_${side}` });
        }
        propStateFn = (frame) => SIDES.map((side) => propAtGrip(body, frame, side, "grip"));
        tetherStateFn = (_frame, _ex, ps) => [
          { points: [[sp, ay, 0], ps[0].pos] },
          { points: [[-sp, ay, 0], ps[1].pos] },
        ];
      } else if (app.kind === "prowler-sled") {
        props.push(prowlerSledProp("sled"));
        addContacts("sled", HAND_ALLOW);
        const offZ = app.sledOffsetZ ?? 0.34;
        for (const side of SIDES) {
          loads.push({ anchor: `press_${side}`, share: 0.5, grip: "press", direction: [0, 0, -1] });
        }
        propStateFn = (frame) => {
          const pL = anchorPoint(body, frame, "press_L");
          const pR = anchorPoint(body, frame, "press_R");
          return [{ pos: [0, 0, (pL.z + pR.z) / 2 + offZ], quat: IDENTITY }];
        };
      } else if (app.kind === "leg-press-sled") {
        const angle = app.angleDeg ?? 45;
        const rail = legPressRailDir ?? [0, Math.sin(rad(angle)), Math.cos(rad(angle))];
        props.push(legPressSledProp("sled", angle));
        addContacts("sled", { foot_L: 0.04, foot_R: 0.04 });
        const sides = st.kind === "leg-press" && st.singleLeg ? [st.singleLeg] : SIDES;
        const forceDir: Vec3 = [-rail[0], -rail[1], -rail[2]];
        for (const side of sides) {
          loads.push({ anchor: `ballIn_${side}`, share: 1 / sides.length, grip: "rest", direction: forceDir });
          required.push({ label: `${side === "L" ? "Left" : "Right"} foot on sled`, anchor: `ballIn_${side}`, prop: "sled" });
        }
        propStateFn = (frame) => {
          const sum = new Vector3();
          for (const side of sides) {
            sum.add(anchorPoint(body, frame, `heel_${side}`));
            sum.add(anchorPoint(body, frame, `ballIn_${side}`));
          }
          sum.divideScalar(sides.length * 2);
          return [
            {
              pos: [0, sum.y + rail[1] * 0.03, sum.z + rail[2] * 0.03],
              quat: IDENTITY,
            },
          ];
        };
      }

      // 3. Standing CoM balance constraint (auto-added for non-rail standing lifts unless disabled)
      if (st.kind === "standing" && !smithRail && st.balanceZ !== false) {
        const balanceLoads = loads
          .filter((l) => !l.pulley && !l.direction)
          .map((l) => ({ anchor: l.anchor, kg: l.share * config.defaultLoadKg }));
        const targetZ =
          st.balanceZ ??
          (st.split ? (st.split.frontZ + st.split.rearZ) * 0.35 + 0.06 : (st.heelZ ?? 0) + 0.085);
        goals.push(balance(body, balanceLoads, targetZ, 12));
      }

      // 4. Bilateral mirroring
      if (laterality === "bilateral") {
        goals.push(mirrored(body, 5));
      }

      // 5. Extra user goals
      if (config.extraGoals) goals.push(...config.extraGoals(body));
      if (config.extraKeyGoals) {
        const ek = config.extraKeyGoals(body);
        if (ek.start) keyStart.push(...ek.start);
        if (ek.end) keyEnd.push(...ek.end);
      }

      // 6. Alternating waypoints auto-generation
      let waypoints = config.waypoints;
      let loopMode = config.loopMode;
      if (!waypoints && laterality === "alternating") {
        const leftPeak = config.hints.end;
        const rightPeak = mirrorHints(leftPeak);
        waypoints = [
          { hints: config.hints.start, duration: 1.3, hold: 0.2 },
          { hints: leftPeak, duration: 1.3, hold: 0.25 },
          { hints: config.hints.start, duration: 1.3, hold: 0.2 },
          { hints: rightPeak, duration: 1.3, hold: 0.25 },
        ];
        loopMode = "cycle";
      }

      // 7. Default progress scalar
      const progressAnchor =
        app.kind === "roller-pad"
          ? app.trackAnchors[0]
          : app.kind === "leg-press-sled"
            ? "ballIn_L"
            : `grip_${activeSide}`;
      const progressFn =
        config.progress !== undefined
          ? (frame: Frame) => config.progress!(body, frame)
          : (frame: Frame) => {
              const p = anchorPoint(body, frame, progressAnchor);
              return p.y + 0.35 * p.z;
            };

      return {
        hints: config.hints,
        waypoints,
        loopMode,
        isometric: config.isometric,
        phaseLabels: config.phaseLabels,
        extras,
        extraStart,
        goals,
        keyGoals: { start: keyStart, end: keyEnd },
        stiffness: { ...DEFAULT_STIFFNESS, ...config.stiffness },
        obstacles,
        path: pathFn,
        progress: progressFn,
        ground,
        props,
        propState: propStateFn,
        ...(tethers.length ? { tethers, tetherState: tetherStateFn } : {}),
        equipment: dynamicEquipmentFn ?? (() => staticParts),
        loads,
        support,
        grip: config.grip,
        cameraHint: config.cameraHint,
        laterality,
        tempo: config.tempo ?? { lower: 1.8, bottom: 0.3, raise: 1.6, top: 0.5 },
        contacts,
        required,
        checks: config.checks(body),
      };
    },
  };
}

export { POSTURE_HINTS, PAD_RESTING };
