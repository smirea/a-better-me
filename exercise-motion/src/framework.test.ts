import { describe, expect, test } from "bun:test";
import { analyze } from "./biomech";
import { createBody } from "./body";
import { compileParts, signedDistance, sphere, capsule } from "./equipment";
import { generate, kinematics, type ExerciseSpec } from "./exercise";
import { smithMachineBackSquat } from "./exercises/smith-machine-back-squat";
import { validateMotion } from "./validate";
import { catalogSlugMap, loadAppCatalog } from "../scripts/catalog-io";
import { Vector3 } from "three";

describe("exercise-motion framework invariants", () => {
  const sharedBody = createBody();
  const sharedSquat = generate(smithMachineBackSquat, sharedBody).sequence;

  test("every catalog exercise maps to a unique kebab-case slug", () => {
    const catalog = loadAppCatalog();
    const map = catalogSlugMap();
    expect(map.size).toBe(catalog.length);
    const unique = new Set(map.values());
    expect(unique.size).toBe(catalog.length);
    for (const slug of unique) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test("generate throws before solving when a spec references an unknown anchor, prop, or collider", () => {
    const badAnchorSpec: ExerciseSpec = {
      ...smithMachineBackSquat,
      id: "bad-anchor-spec",
      build(body) {
        const b = smithMachineBackSquat.build(body);
        return { ...b, ground: "does_not_exist" };
      },
    };
    expect(() => generate(badAnchorSpec)).toThrow(/unknown ground anchor/i);

    const badPropSpec: ExerciseSpec = {
      ...smithMachineBackSquat,
      id: "bad-prop-spec",
      build(body) {
        const b = smithMachineBackSquat.build(body);
        return {
          ...b,
          required: [{ label: "Missing prop", anchor: "grip_L", prop: "ghost_bar" }],
        };
      },
    };
    expect(() => generate(badPropSpec)).toThrow(/unknown prop/i);

    const badColliderSpec: ExerciseSpec = {
      ...smithMachineBackSquat,
      id: "bad-collider-spec",
      build(body) {
        const b = smithMachineBackSquat.build(body);
        return {
          ...b,
          contacts: { bar: { nonexistent_limb: 0.05 } },
        };
      },
    };
    expect(() => generate(badColliderSpec)).toThrow(/unknown collider/i);
  });

  test("bilateral sequences flag left-right asymmetry while unilateral sequences allow it", () => {
    const body = sharedBody;
    const broken = structuredClone(sharedSquat);
    const elbowL = body.joints[body.index.elbow_L].dofStart;
    for (const pose of broken.poses) pose[elbowL] += 0.35;

    const bilateralIssues = validateMotion(body, broken, kinematics(body, broken));
    expect(bilateralIssues.some((i) => i.code === "asymmetric")).toBe(true);

    const unilateral = { ...broken, laterality: "unilateral" as const };
    const unilateralIssues = validateMotion(body, unilateral, kinematics(body, unilateral));
    expect(unilateralIssues.some((i) => i.code === "asymmetric")).toBe(false);
  });

  test("a cable pulley load pulls toward the pulley instead of downward gravity", () => {
    const body = sharedBody;
    const base = {
      ...sharedSquat,
      poses: sharedSquat.poses.slice(0, 8),
      s: sharedSquat.s.slice(0, 8),
      propStates: sharedSquat.propStates.slice(0, 8),
      support: { kind: "seated" as const, passive: ["hip", "knee", "ankle", "lumbar", "thoracic", "neck"] },
      loadKg: 40,
    };
    const downward = {
      ...base,
      loads: [{ anchor: "grip_L", share: 1, grip: "hang" as const }],
    };
    const overheadPulley = {
      ...base,
      loads: [{ anchor: "grip_L", share: 1, grip: "hang" as const, pulley: [0.38, 3.0, 0] as [number, number, number] }],
    };
    const kin = kinematics(body, base);
    const downDemands = analyze(body, downward, kin, 40).demands[0];
    const upDemands = analyze(body, overheadPulley, kin, 40).demands[0];
    // Pulling upward overhead reverses the shoulder/elbow torque sign compared to downward gravity.
    expect(Math.sign(upDemands["shoulder_L.abd"])).not.toBe(Math.sign(downDemands["shoulder_L.abd"]));
  });

  test("signed distance reports negative inside and positive outside for spheres and capsules", () => {
    const [ball, roll] = compileParts([
      sphere("b", [0, 1, 0], 0.25, "rubber"),
      capsule("c", [0, 0.5, 0], 0.05, 0.4, "pad"),
    ]);
    expect(signedDistance(ball, new Vector3(0, 1, 0))).toBeCloseTo(-0.25, 4);
    expect(signedDistance(ball, new Vector3(0.4, 1, 0))).toBeCloseTo(0.15, 4);
    expect(signedDistance(roll, new Vector3(0.2, 0.5, 0))).toBeCloseTo(-0.05, 4);
    expect(signedDistance(roll, new Vector3(0.3, 0.5, 0))).toBeCloseTo(0.05, 4);
  });

  test("bodyweightShare loads closed-chain bodyweight exercises and assistance reduces effective load", () => {
    const body = sharedBody;
    const base = {
      ...sharedSquat,
      poses: sharedSquat.poses.slice(0, 4),
      s: sharedSquat.s.slice(0, 4),
      propStates: sharedSquat.propStates.slice(0, 4),
      support: { kind: "hanging" as const, passive: ["hip", "knee", "ankle"] },
      loadKg: 0,
    };
    const kin = kinematics(body, base);
    const bwOnly = analyze(
      body,
      {
        ...base,
        loads: [{ anchor: "grip_L", share: 0.5, bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] }],
      },
      kin,
      0,
    );
    const assisted = analyze(
      body,
      {
        ...base,
        loads: [{ anchor: "grip_L", share: -0.5, bodyweightShare: 0.5, grip: "hang", direction: [0, 1, 0] }],
      },
      kin,
      30,
    );
    expect(Math.abs(bwOnly.demands[0]["shoulder_L.abd"])).toBeGreaterThan(
      Math.abs(assisted.demands[0]["shoulder_L.abd"]),
    );
  });
});
