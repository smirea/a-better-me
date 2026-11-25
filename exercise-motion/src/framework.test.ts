import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { analyze } from "./biomech";
import { anchorPoint, createBody, type Body } from "./body";
import { compileParts, signedDistance, sphere, capsule } from "./equipment";
import { generate, kinematics, type ExerciseSpec } from "./exercise";
import { validateGlbMotion } from "./glb-collision";
import { plantBothFeet, POSTURE_HINTS } from "./postures";
import { applySkinToObject3D, getSkin } from "./skin";
import { balance, mirrored, pin } from "./solver";
import { validateMotion } from "./validate";
import { catalogSlugMap, loadAppCatalog } from "../scripts/catalog-io";

/** Minimal self-contained synthetic spec used to verify engine invariants without relying on catalog exercises. */
const syntheticSquat: ExerciseSpec = {
  id: "synthetic-squat",
  catalogId: "synthetic-squat",
  name: "Synthetic Squat",
  defaultLoadKg: 40,
  loadUnit: "total",
  laterality: "bilateral",
  build(body: Body) {
    const startH = { ...POSTURE_HINTS.standing, "shoulder.elev": 10, "elbow.flex": 15 };
    const endH = {
      ...POSTURE_HINTS.standing,
      "root.y": 0.68,
      "root.pitch": 18,
      "hip.flex": 78,
      "knee.flex": 85,
      "ankle.dorsi": 18,
      "shoulder.elev": 10,
      "elbow.flex": 15,
    };
    return {
      hints: { start: startH, end: endH },
      extras: 0,
      extraStart: [],
      goals: [
        ...plantBothFeet(body, 0.16, 0, 0.14, 0, 42),
        balance(body, [], 0.04, 14),
        mirrored(body, 6),
      ],
      keyGoals: {
        start: [pin(body, "pelvisBottom", () => new Vector3(0, 0.86, 0), 12, "y")],
        end: [pin(body, "pelvisBottom", () => new Vector3(0, 0.62, -0.06), 12, "y")],
      },
      stiffness: { default: 0.6, root: 0.4, lumbar: 8, thoracic: 8 },
      obstacles: [],
      progress: (frame) => anchorPoint(body, frame, "pelvisBottom").y,
      ground: "heel_L",
      props: [],
      propState: () => [],
      equipment: () => [],
      loads: [{ anchor: "upperBack", share: 1, grip: "rest" }],
      support: { kind: "standing", brace: true },
      tempo: { lower: 1.5, bottom: 0.2, raise: 1.2, top: 0.2 },
      contacts: {},
      required: [
        { label: "Left heel planted", anchor: "heel_L", surfaceY: 0 },
        { label: "Right heel planted", anchor: "heel_R", surfaceY: 0 },
      ],
      checks: [],
      laterality: "bilateral",
    };
  },
};

describe("exercise-motion framework invariants", () => {
  const sharedBody = createBody();
  const sharedSquat = generate(syntheticSquat, sharedBody).sequence;

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
      ...syntheticSquat,
      id: "bad-anchor-spec",
      build(body) {
        const b = syntheticSquat.build(body);
        return { ...b, ground: "does_not_exist" };
      },
    };
    expect(() => generate(badAnchorSpec)).toThrow(/unknown ground anchor/i);

    const badPropSpec: ExerciseSpec = {
      ...syntheticSquat,
      id: "bad-prop-spec",
      build(body) {
        const b = syntheticSquat.build(body);
        return {
          ...b,
          required: [{ label: "Missing prop", anchor: "grip_L", prop: "ghost_bar" }],
        };
      },
    };
    expect(() => generate(badPropSpec)).toThrow(/unknown prop/i);

    const badColliderSpec: ExerciseSpec = {
      ...syntheticSquat,
      id: "bad-collider-spec",
      build(body) {
        const b = syntheticSquat.build(body);
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

  test("cable segments cutting through the torso trigger a cable-clip error", () => {
    const body = sharedBody;
    const base = {
      ...sharedSquat,
      poses: sharedSquat.poses.slice(0, 4),
      s: sharedSquat.s.slice(0, 4),
      propStates: sharedSquat.propStates.slice(0, 4),
      tethers: [{ id: "cable_L", kind: "cable" as const }],
      tetherStates: Array.from({ length: 4 }, () => [{ points: [[-0.6, 1.25, 0.02] as [number, number, number], [0.6, 1.25, 0.02] as [number, number, number]] }]),
    };
    const issues = validateMotion(body, base, kinematics(body, base));
    expect(issues.some((i) => i.code === "cable-clip" && i.severity === "error")).toBe(true);
  });

  test("applySkinToObject3D swaps canonical semantic materials without touching non-semantic materials", () => {
    const group = new Group();
    const frameMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ name: "mat_frame.001", color: "#000000" }));
    const customMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ name: "custom_logo", color: "#ff00ff" }));
    group.add(frameMesh, customMesh);

    const skin = getSkin("obsidian-crimson");
    const result = applySkinToObject3D(group, skin);
    expect(result.matched).toBe(1);
    expect(result.unmatched).toEqual(["custom_logo"]);
    expect(`#${(frameMesh.material as MeshStandardMaterial).color.getHexString()}`).toBe(skin.materials.mat_frame.color);
    expect(`#${(customMesh.material as MeshStandardMaterial).color.getHexString()}`).toBe("#ff00ff");
  });

  test("validateGlbMotion catches a body clipping into a GLB mesh and a contact anchor far from the GLB", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "glb-col-test-"));
    try {
      const doc = new Document();
      const buf = doc.createBuffer();
      // 0.6 x 0.6 x 0.6 m cube centered at (0, 1.15, 0.02) — directly overlapping the standing torso.
      const s = 0.3;
      const verts = new Float32Array([
        -s, -s, s, s, -s, s, s, s, s, -s, s, s,
        -s, -s, -s, -s, s, -s, s, s, -s, s, -s, -s,
        -s, s, -s, -s, s, s, s, s, s, s, s, -s,
        -s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s,
        s, -s, -s, s, s, -s, s, s, s, s, -s, s,
        -s, -s, -s, -s, -s, s, -s, s, s, -s, s, -s,
      ]);
      const idx = new Uint16Array([
        0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
        12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
      ]);
      const mat = doc.createMaterial("mat_frame");
      const prim = doc
        .createPrimitive()
        .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(verts).setBuffer(buf))
        .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buf))
        .setMaterial(mat);
      const mesh = doc.createMesh("SteelBox").addPrimitive(prim);
      const node = doc.createNode("BoxNode").setMesh(mesh).setTranslation([0, 1.15, 0.02]);
      doc.createScene().addChild(node);
      await new NodeIO().write(join(tmp, "test-box.glb"), doc);

      const seq = {
        ...sharedSquat,
        poses: sharedSquat.poses.slice(0, 4),
        s: sharedSquat.s.slice(0, 4),
        propStates: sharedSquat.propStates.slice(0, 4),
        glb: [{ id: "test-box", pos: [0, 0, 0] as [number, number, number], hideEquipment: true }],
        required: [{ label: "Far heel on box", anchor: "heel_L", part: "fake.part" }],
      };
      const issues = await validateGlbMotion(sharedBody, seq, kinematics(sharedBody, seq), {
        modelDirs: [tmp],
        frameStride: 1,
      });
      expect(issues.some((i) => i.code === "glb-clip" && i.severity === "error")).toBe(true);
      expect(issues.some((i) => i.code === "contact-lost" && i.severity === "error")).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
