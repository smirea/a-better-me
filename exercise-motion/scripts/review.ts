#!/usr/bin/env bun
import { analyze } from "../src/biomech";
import { generate, kinematics } from "../src/exercise";
import { EXERCISES } from "../src/exercises";
import { runChecks, validateLoad, validateMotion } from "../src/validate";

for (const spec of EXERCISES.filter(
  (exercise) => !process.argv[2] || exercise.id === process.argv[2],
)) {
  const { body, built, sequence } = generate(spec);
  const kin = kinematics(body, sequence);
  const analysis = analyze(body, sequence, kin);
  console.log(`\n== ${spec.name} (${sequence.poses.length} frames, ${sequence.loadKg} kg)`);
  for (const issue of [
    ...validateMotion(body, sequence, kin),
    ...validateLoad(sequence, analysis),
  ]) {
    console.log(
      `  ${issue.severity.toUpperCase()} [${issue.code}] ${issue.title}: ${issue.detail} (frames ${issue.frames.map((r) => r.join("-")).join(", ")})`,
    );
  }
  for (const check of runChecks(body, built, sequence, kin))
    console.log(`  ${check.pass ? "pass" : "FAIL"}  ${check.label}: ${check.measured}`);
}
