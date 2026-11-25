import { adjustableBenchMachine } from "./adjustable-bench";
import { aerobicStepMachine } from "./aerobic-step";
import { backExtensionBenchMachine } from "./back-extension-bench";
import { chestPressMachine } from "./chest-press-machine";
import { declineBenchMachine } from "./decline-bench";
import { SPECS } from "./core";
import { dipPullupStationMachine } from "./dip-pullup-station";
import { dualAdjustablePulleyMachine } from "./dual-adjustable-pulley";
import { ghdMachine } from "./ghd";
import { landmineMachine } from "./landmine";
import { latPulldownMachine } from "./lat-pulldown";
import { legExtensionMachine } from "./leg-extension";
import { legPress45Machine } from "./leg-press-45";
import { olympicInclineBenchMachine } from "./olympic-incline-bench";
import { plyoBoxMachine } from "./plyo-box";
import { powerRackMachine, rackHeightsFor } from "./power-rack";
import { preacherBenchMachine } from "./preacher-bench";
import { seatedCableRowMachine } from "./seated-cable-row";
import { seatedLegCurlMachine } from "./seated-leg-curl";
import { singleCableTowerMachine } from "./single-cable-tower";
import { slantBoardMachine } from "./slant-board";
import { smithMachineMachine } from "./smith-machine";

export * from "./core";
export * from "./free-weights";
export * from "./skins";
export {
  adjustableBenchMachine,
  aerobicStepMachine,
  backExtensionBenchMachine,
  chestPressMachine,
  declineBenchMachine,
  dipPullupStationMachine,
  dualAdjustablePulleyMachine,
  ghdMachine,
  landmineMachine,
  latPulldownMachine,
  legExtensionMachine,
  legPress45Machine,
  olympicInclineBenchMachine,
  plyoBoxMachine,
  powerRackMachine,
  rackHeightsFor,
  preacherBenchMachine,
  seatedCableRowMachine,
  seatedLegCurlMachine,
  singleCableTowerMachine,
  slantBoardMachine,
  smithMachineMachine,
};

/** Every canonical machine's default instance, keyed by id (also the GLB file name under `models/machines/`). */
export const MACHINES = {
  "adjustable-bench": () => adjustableBenchMachine(),
  "power-rack": () => powerRackMachine(),
  "olympic-incline-bench": () => olympicInclineBenchMachine(),
  "dual-adjustable-pulley": () => dualAdjustablePulleyMachine(),
  "single-cable-tower": () => singleCableTowerMachine(),
  "lat-pulldown": () => latPulldownMachine(),
  "seated-cable-row": () => seatedCableRowMachine(),
  "smith-machine": () => smithMachineMachine(),
  "leg-press-45": () => legPress45Machine(),
  "leg-extension": () => legExtensionMachine(),
  "seated-leg-curl": () => seatedLegCurlMachine(),
  "chest-press-machine": () => chestPressMachine(),
  "dip-pullup-station": () => dipPullupStationMachine(),
  "preacher-bench": () => preacherBenchMachine(),
  "back-extension-bench": () => backExtensionBenchMachine(),
  "plyo-box": () => plyoBoxMachine(),
  "aerobic-step": () => aerobicStepMachine(),
  landmine: () => landmineMachine(),
  "decline-bench": () => declineBenchMachine(),
  ghd: () => ghdMachine(),
  "slant-board": () => slantBoardMachine(),
} as const;

export type MachineId = keyof typeof MACHINES;

for (const spec of Object.values(SPECS)) {
  if (spec.kind === "machine" && !(spec.id in MACHINES)) throw new Error(`anchors.json has ${spec.id} but no factory`);
}
