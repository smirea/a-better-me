import type { Body, Frame, PoseHints } from "./body";
import type { CanonicalMachineInstance, HandGripConfig } from "./contracts";
import {
  compileParts,
  type GlbNodePose,
  type GlbRef,
  type Part,
  type PropDef,
  type PropState,
  type TetherDef,
  type TetherState,
} from "./equipment";
import type {
  Built,
  CameraHint,
  ExerciseSpec,
  FormCheck,
  Laterality,
  LoadAttachment,
  RequiredContact,
  Support,
  Tempo,
  WaypointSpec,
} from "./exercise";
import type { Grasp, LiveProps } from "./grasp";
import type { Goal, Obstacle } from "./solver";

export interface SceneContext {
  /** Instantiated canonical machines in declaration order. */
  machines: CanonicalMachineInstance[];
  /** First canonical machine (convenience for single-machine exercises). */
  machine: CanonicalMachineInstance | null;
  /** Merged static collider parts from all canonical machines. */
  equipment: Part[];
  /** Merged contact penetration allowances from all canonical machines. */
  contacts: Record<string, Record<string, number>>;
  /**
   * Every prop's state for a candidate pose, for goals that follow moving equipment (`holdGrasp` on a lever handle, feet on a
   * sled). Only callable from inside a goal, once the scene is assembled.
   */
  live: LiveProps;
}

export interface SceneBodyPlan {
  hints: { start: PoseHints; end: PoseHints };
  waypoints?: WaypointSpec[];
  loopMode?: "cycle" | "pingpong";
  isometric?: boolean;
  phaseLabels?: [string, string, string, string];
  extras?: number;
  extraStart?: number[];
  goals: Goal[];
  keyGoals: { start: Goal[]; end: Goal[] };
  stiffness: Record<string, number>;
  path?: (s: number, start: number[], end: number[]) => number[];
  progress: (frame: Frame) => number;
  ground: string;
  /** Extra exercise-owned props appended after any machine-owned props (e.g. barbell, dumbbells, D-handles). */
  props?: PropDef[];
  propState?: (frame: Frame, extras: number[]) => PropState[];
  tethers?: TetherDef[];
  tetherState?: (frame: Frame, extras: number[], propStates: PropState[]) => TetherState[];
  /** Extra static equipment parts appended after the canonical machines' parts. */
  extraEquipment?: Part[];
  /** Extra GLB node animations appended per GLB index on top of canonical machine glbState. */
  glbState?: (frame: Frame, extras: number[], propStates: PropState[]) => GlbNodePose[][];
  /** Additional or overriding contact allowances merged over the canonical machine defaults. */
  contacts?: Record<string, Record<string, number>>;
  loads: LoadAttachment[];
  support: Support;
  tempo?: Tempo;
  required: RequiredContact[];
  checks: FormCheck[];
  /** What each hand holds (`machine.grasp(side, key)`, `graspProp`); sets the fingers and is checked every frame. */
  grasps?: Grasp[];
  /** Finger pose for free hands: `open`, `flat-floor` (palm on a surface), `relaxed` (default), `fist`. */
  grips?: HandGripConfig;
  cameraHint?: CameraHint;
}

export interface ComposeExerciseConfig {
  id: string;
  catalogId: string;
  name: string;
  defaultLoadKg: number;
  loadUnit: "total" | "perSide";
  laterality?: Laterality;
  /**
   * Pick zero, one, or several canonical pre-rigged machines from `src/machines/`.
   * Exercises reference shared canonical GLBs instead of duplicating machine models.
   */
  machines?:
    | ((body: Body) => CanonicalMachineInstance | CanonicalMachineInstance[] | null | undefined)
    | CanonicalMachineInstance
    | CanonicalMachineInstance[]
    | null;
  setup: (body: Body, ctx: SceneContext) => SceneBodyPlan;
}

function mergeContacts(
  sources: Record<string, Record<string, number>>[],
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const src of sources) {
    for (const [prefix, map] of Object.entries(src)) {
      out[prefix] = { ...out[prefix], ...map };
    }
  }
  return out;
}

const DEFAULT_TEMPO: Tempo = { lower: 1.8, bottom: 0.3, raise: 1.5, top: 0.35 };

/**
 * First-principles scene builder: select canonical machine(s) from `src/machines/` and set up
 * the lifter's body, grips, feet, motion goals, and form checks. Automatically wires GLBs,
 * articulated node poses, machine-owned props, colliders, and contact allowances without
 * duplicating machine assets or boilerplate across exercises.
 */
export function composeExercise(config: ComposeExerciseConfig): ExerciseSpec {
  return {
    id: config.id,
    catalogId: config.catalogId,
    name: config.name,
    defaultLoadKg: config.defaultLoadKg,
    loadUnit: config.loadUnit,
    laterality: config.laterality,
    build(body: Body): Built {
      const rawMachines =
        typeof config.machines === "function" ? config.machines(body) : config.machines;
      const machines: CanonicalMachineInstance[] = !rawMachines
        ? []
        : Array.isArray(rawMachines)
          ? rawMachines
          : [rawMachines];

      const baseEquipment = machines.flatMap((m) => m.equipment);
      const baseContacts = mergeContacts(machines.map((m) => m.contacts));
      let assembled: LiveProps | null = null;
      const plan = config.setup(body, {
        machines,
        machine: machines[0] ?? null,
        equipment: baseEquipment,
        contacts: baseContacts,
        live: (frame, q) => {
          if (!assembled) throw new Error(`${config.id}: ctx.live is only callable from inside a goal`);
          return assembled(frame, q);
        },
      });

      const allEquipment: Part[] = [...baseEquipment, ...(plan.extraEquipment ?? [])];
      const contacts = plan.contacts ? mergeContacts([baseContacts, plan.contacts]) : baseContacts;

      const allowFor = (partId: string): Record<string, number> => {
        const merged: Record<string, number> = {};
        for (const [prefix, map] of Object.entries(contacts)) {
          if (partId === prefix || partId.startsWith(prefix)) Object.assign(merged, map);
        }
        return merged;
      };

      const obstacles: Obstacle[] = compileParts(allEquipment.filter((p) => p.collide)).map(
        (shape) => ({
          shape,
          allow: allowFor(shape.part.id),
        }),
      );

      const glb: GlbRef[] = machines.flatMap((m) => m.glb);
      const userProps: PropDef[] = plan.props ?? [];
      const machineProps: PropDef[] = machines.flatMap((m) => m.props ?? []);
      const props: PropDef[] = [...userProps, ...machineProps];

      const propState = (frame: Frame, extras: number[]): PropState[] => {
        const userStates = plan.propState ? plan.propState(frame, extras) : [];
        const machineStates = machines.flatMap((m) =>
          m.propState ? m.propState(frame, extras, userStates) : [],
        );
        return [...userStates, ...machineStates];
      };

      assembled = (frame, q) => ({ props, states: propState(frame, [...q.subarray(body.dofCount)]) });

      const hasMachineGlbState = machines.some((m) => Boolean(m.glbState));
      const glbState =
        glb.length > 0 && (hasMachineGlbState || plan.glbState)
          ? (frame: Frame, extras: number[], propStates: PropState[]): GlbNodePose[][] => {
              const base: GlbNodePose[][] = [];
              for (const m of machines) {
                if (m.glbState) {
                  const rows = m.glbState(frame, extras, propStates);
                  for (let i = 0; i < m.glb.length; i++) base.push(rows[i] ?? []);
                } else {
                  for (let i = 0; i < m.glb.length; i++) base.push([]);
                }
              }
              if (plan.glbState) {
                const extra = plan.glbState(frame, extras, propStates);
                for (let i = 0; i < base.length; i++) {
                  if (extra[i]?.length) base[i] = [...base[i], ...extra[i]];
                }
              }
              return base;
            }
          : undefined;

      const machineIds = machines.map((m) => m.id);

      return {
        hints: plan.hints,
        waypoints: plan.waypoints,
        loopMode: plan.loopMode,
        isometric: plan.isometric,
        phaseLabels: plan.phaseLabels,
        extras: plan.extras ?? 0,
        extraStart: plan.extraStart ?? [],
        goals: plan.goals,
        keyGoals: plan.keyGoals,
        stiffness: plan.stiffness,
        obstacles,
        path: plan.path,
        progress: plan.progress,
        ground: plan.ground,
        props,
        propState,
        tethers: plan.tethers,
        tetherState: plan.tetherState,
        equipment: () => allEquipment,
        ...(glb.length ? { glb } : {}),
        ...(glbState ? { glbState } : {}),
        ...(machineIds.length ? { machineIds } : {}),
        loads: plan.loads,
        support: plan.support,
        tempo: plan.tempo ?? DEFAULT_TEMPO,
        contacts,
        required: plan.required,
        checks: plan.checks,
        laterality: config.laterality ?? "bilateral",
        grasps: plan.grasps,
        grips: plan.grips,
        cameraHint: plan.cameraHint ?? machines[0]?.cameraHint,
      };
    },
  };
}
