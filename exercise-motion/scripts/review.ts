#!/usr/bin/env bun
import { analyze } from "../src/biomech";
import { kinematics } from "../src/exercise";
import { EXERCISES } from "../src/exercises";
import { runChecks, validateLoad, validateMotion } from "../src/validate";
import { listedMuscles } from "./catalog-io";
import { generated } from "./motion-cache";

const specs = EXERCISES.filter((exercise) => !process.argv[2] || exercise.id === process.argv[2]);
for (const [i, { body, built, sequence }] of (await generated(specs)).entries()) {
  const spec = specs[i];
  const kin = kinematics(body, sequence);
  const analysis = analyze(body, sequence, kin);
  console.log(`\n== ${spec.name} (${sequence.poses.length} frames, ${sequence.loadKg} kg)`);
  for (const issue of [
    ...validateMotion(body, sequence, kin),
    ...validateLoad(sequence, analysis, listedMuscles(spec)),
  ]) {
    console.log(
      `  ${issue.severity.toUpperCase()} [${issue.code}] ${issue.title}: ${issue.detail} (frames ${issue.frames.map((r) => r.join("-")).join(", ")})`,
    );
  }
  for (const check of runChecks(body, built, sequence, kin))
    console.log(`  ${check.pass ? "pass" : "FAIL"}  ${check.label}: ${check.measured}`);
}
