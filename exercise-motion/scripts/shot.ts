#!/usr/bin/env bun
import { $ } from 'bun';
import { join } from 'node:path';

const [out, hash = '', size = '1440,900', scale = '1'] = process.argv.slice(2);
if (!out)
	throw new Error(
		'Usage: shot.ts <out.png> ["ex=0&frame=60&view=Side&tab=Muscles&play=0"] [width,height] [device pixel ratio]',
	);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const page = `file://${join(import.meta.dir, '../dist/exercise-motion.html')}#${hash}`;
await $`${chrome} --headless=new --hide-scrollbars --enable-unsafe-swiftshader --use-angle=swiftshader --window-size=${size} --force-device-scale-factor=${scale} --virtual-time-budget=4000 --screenshot=${out} ${page}`.quiet();
console.log(out);
