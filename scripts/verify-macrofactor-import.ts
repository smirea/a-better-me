#!/usr/bin/env bun
/**
 * Checks a server against the MacroFactor files it was imported from, printing counts only (never values):
 * per day, the entries' summed calories and macros against the export's own daily totals, and each table's rows
 * against the export's rows. Exit 1 when anything disagrees.
 *
 *   bun scripts/verify-macrofactor-import.ts --server <url> --token <token> <granular.xlsx> <food-log.csv>
 */
import { parseArgs } from 'node:util';
import { parseExports, readExport } from './import-macrofactor';

type Row = Record<string, any>;

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: { server: { type: 'string' }, token: { type: 'string' } },
});
if (!values.server || !values.token || !positionals.length) {
	console.error('Usage: bun scripts/verify-macrofactor-import.ts --server <url> --token <token> <files...>');
	process.exit(2);
}

async function get(path: string): Promise<any> {
	const response = await fetch(new URL(`/api${path}`, values.server), {
		headers: { authorization: `Bearer ${values.token}` },
	});
	if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
	return response.json();
}
async function every(path: string): Promise<Row[]> {
	const rows: Row[] = [];
	for (let offset = 0; ; offset += 1000) {
		const page: Row[] = await get(`${path}?limit=1000&offset=${offset}`);
		rows.push(...page);
		if (page.length < 1000) return rows;
	}
}

const parsed = parseExports(positionals.map(readExport));
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: string) => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${detail}`);
	if (!ok) failures.push(label);
};

const entries = await every('/food-entries');
const expectedIds = new Set(parsed.entries.keys());
const ids = new Set(entries.map(entry => entry.id));
check(
	'food entries',
	[...expectedIds].every(id => ids.has(id)),
	`${expectedIds.size} in the export, ${[...expectedIds].filter(id => ids.has(id)).length} found, ${entries.length} on the server`,
);

const sums = new Map<string, Row>();
for (const entry of entries) {
	const day = sums.get(entry.day) ?? { k: 0, p: 0, f: 0, c: 0, n: 0 };
	for (const key of ['k', 'p', 'f', 'c']) day[key] += entry.amounts[key] ?? 0;
	day.n++;
	sums.set(entry.day, day);
}
let matched = 0;
const off: string[] = [];
for (const [day, totals] of parsed.totals) {
	const sum = sums.get(day);
	// The export rounds every entry and every daily total to whole units, so n entries may drift by (n + 1) / 2.
	const tolerance = ((sum?.n ?? 0) + 1) / 2;
	const differs = ['k', 'p', 'f', 'c'].filter(key => Math.abs((sum?.[key] ?? 0) - (totals[key] ?? 0)) > tolerance);
	if (differs.length) off.push(`${day} (${differs.join(',')})`);
	else matched++;
}
check(
	'daily totals vs the export',
	off.length === 0,
	`${matched} of ${parsed.totals.size} days within the export's rounding${off.length ? `; off: ${off.slice(0, 10).join(' ')}` : ''}`,
);

const stored = await every('/body-weights');
const readings = new Map<string, Row[]>();
for (const weighIn of stored)
	readings.set(weighIn.measuredAt.slice(0, 10), [...(readings.get(weighIn.measuredAt.slice(0, 10)) ?? []), weighIn]);
const wanted = [...parsed.weights.values()] as Row[];
const missingWeights = wanted.filter(
	row => !readings.get(row.measuredAt.slice(0, 10))?.some(weighIn => Math.abs(weighIn.weightKg - row.weightKg) < 0.05),
).length;
const doubled = [...readings.values()].filter(day => day.length > 1).length;
const fatMissing = wanted.filter(
	row =>
		row.bodyFatPercent !== null &&
		!readings.get(row.measuredAt.slice(0, 10))?.some(weighIn => weighIn.bodyFatPercent === row.bodyFatPercent),
).length;
check(
	'body weights',
	missingWeights === 0 && fatMissing === 0,
	`${wanted.length} days in the export, ${missingWeights} missing, ${fatMissing} without their body fat, ${doubled} days with more than one weigh-in, ${stored.length} on the server`,
);

for (const [table, path, expected] of [
	['body metrics', '/body-metrics', parsed.metrics],
	['recipes', '/recipes', parsed.recipes],
	['nutrition plans', '/nutrition-plans', parsed.plans],
] as const) {
	const found = new Set((await every(path)).map(row => String(row.id)));
	const missing = [...expected.keys()].filter(id => !found.has(id)).length;
	check(table, missing === 0, `${expected.size} in the export, ${missing} missing, ${found.size} on the server`);
}

process.exit(failures.length ? 1 : 0);
