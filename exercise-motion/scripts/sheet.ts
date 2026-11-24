#!/usr/bin/env bun
import { $ } from 'bun';
import { generate } from '../src/exercise';
import { EXERCISES } from '../src/exercises';
import { contactSheet } from '../src/sheet';

const [id, out = `${id}.png`, viewList = 'side,front'] = process.argv.slice(2);
const spec = EXERCISES.find(exercise => exercise.id === id);
if (!spec)
	throw new Error(`Usage: sheet.ts <${EXERCISES.map(exercise => exercise.id).join(' | ')}> [out.png] [side,front,top]`);

const started = performance.now();
const { sequence } = generate(spec);
console.log(`${spec.name}: ${sequence.poses.length} frames in ${((performance.now() - started) / 1000).toFixed(1)} s`);
const lower = sequence.phases[0];
const frames = [0, 0.25, 0.5, 0.75, 1].map(u => Math.round(lower.from + (lower.to + 1 - lower.from) * u));
const svg = contactSheet(sequence, frames, viewList.split(',') as never);
const svgPath = out.replace(/\.png$/, '.svg');
await Bun.write(svgPath, svg);
await $`rsvg-convert ${svgPath} -o ${out}`;
console.log(out);
