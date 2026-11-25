import { Matrix4 } from "three";
import { defineMachine, FEET } from "./core";

export interface PlyoBoxState {
  /** Which face it rests on: a 3-in-1 box is 0.51, 0.61, or 0.76 m tall. */
  height: 0.51 | 0.61 | 0.76;
}

export const plyoBoxMachine = defineMachine<PlyoBoxState>({
  id: "plyo-box",
  defaults: { height: 0.51 },
  normalize: (s) => {
    if (![0.51, 0.61, 0.76].includes(s.height)) throw new Error(`plyo-box: height ${s.height} is not 0.51, 0.61, or 0.76`);
    return s;
  },
  nodes: () => ({}),
  base(s, spec) {
    const [w, h, d] = spec.params.size as number[];
    if (s.height === 0.61) {
      // Tip onto the 0.51 × 0.76 face: depth becomes height.
      return new Matrix4().makeTranslation(0, d / 2, -h / 2).multiply(new Matrix4().makeRotationX(Math.PI / 2));
    }
    if (s.height === 0.76) {
      return new Matrix4().makeTranslation(h / 2, w / 2, 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2));
    }
    return new Matrix4();
  },
  finish(instance, s) {
    const top = instance.surfaces?.[`face_${s.height}`];
    if (!top) throw new Error(`plyo-box: no landing face for height ${s.height}`);
    instance.surfaces!.top = top;
  },
  contacts: (p) => ({ [`${p}.box`]: { ...FEET, pelvis: 0.03, hand_L: 0.02, hand_R: 0.02, shank_L: 0.02, shank_R: 0.02 } }),
});
