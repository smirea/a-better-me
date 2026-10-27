import { bearerToken, type Space, type SqlDriver } from 'sync-engine/core';
import { z } from 'zod';
import { isOwner } from '../api';
import { ApiError, openDb, type Db } from './db';
import * as M from './models';
import { openApi } from './openapi';
import type { Method } from './route';
import { routes, snapshot } from './routes';

/** What runs the agent API: the space's own host, since bot tokens and every row live in it. */
export type AgentHost = { space: Space; driver: SqlDriver; ownerToken: string };

export const TOKEN_PREFIX = 'abm_';

const error = (status: number, message: string, issues?: unknown) =>
	Response.json({ ok: false, error: message, ...(issues !== undefined && { issues }) }, { status });

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

type Actor = { kind: 'owner' } | { kind: 'bot'; id: string; name: string };

async function authenticate(request: Request, db: Db, ownerToken: string): Promise<Actor | null> {
	const token = bearerToken(request);
	if (!token) return null;
	if (await isOwner(request, ownerToken)) return { kind: 'owner' };
	if (!token.startsWith(TOKEN_PREFIX)) return null;
	const row = db.all('api_tokens', 'token_hash = ?', [await sha256Hex(token)])[0];
	return row ? { kind: 'bot', id: row.id, name: row.name } : null;
}

const howToAuthenticate = (base: string) =>
	[
		'A Better Me is a personal workout and nutrition tracker. This API reads and manages its workouts, programs, exercises, gyms, food log, foods, recipes, nutrition strategy, settings, and body metrics.',
		'Every route but this one needs a bot token. The owner creates one in the iOS app under More > API Tokens; it starts with `abm_` and is shown once.',
		`Send it on every request as the header \`Authorization: Bearer abm_...\`, then GET ${base} again: the answer holds the full guide, the current state, and the OpenAPI document.`,
	].join('\n\n');

const guide = (base: string) => `# A Better Me agent API

The owner's workout and nutrition data, as the iOS app holds it. Every write here lands on the server at once and reaches the phone on its next sync, within seconds while the app is open. The last write to a field wins.

## Model

- **Exercises** are the catalog (read-only, about 1,350 MacroFactor exercises) plus the owner's \`custom-\` exercises. Blocks refer to exercises by id, so look ids up with \`GET /exercises?q=bench\`. \`GET /exercises/{id}/history\` lists every logged set of one exercise with its estimated 1-RM, the input for progression.
- **Templates** are reusable workouts: an ordered list of blocks. A block holds one exercise, or several for a superset. Each exercise has sets, and a set has a \`type\`, an optional \`target\` (rep range, RIR, weight, duration), and an optional \`restSeconds\`.
- **Sessions** are logged workouts: the same block tree, where each completed set carries a \`log\` (weight, reps, RIR). \`endedAt: null\` means in progress, and at most one session can be. Each session carries read-only \`stats\`: duration, working sets, volume, sets per muscle, and per-exercise bests, derived as the app derives them.
- **Programs** are a cycle of days repeated \`cycles\` times. A day is a template (\`templateID\`) or a rest day. Program templates have \`programId\` set and may carry \`cycleTargets\`, the sets of each cycle. At most one program is active; \`GET /programs/{id}\` says which day is up next.
- **Gyms** are places to train and the equipment each has, keyed by ids from \`GET /equipment\`. \`GET /exercises?gymId=\` lists what a gym can do.
- **Settings** hold the display weight unit, the default rest per exercise category, the profile, and the Nutrition settings.
- **Food log**: each logged food is an entry at a \`day\` and \`minute\`, holding a snapshot of the food and a \`serving\`; there are no meals. \`GET /food-log/{day}\` is one day with its totals and target, \`GET /food-log?from=&to=\` a range of them. A day row (\`PUT /nutrition-days/{day}\`) marks it \`fasted\` or \`partial\`, or sets an \`override\` that replaces its totals.
- **Foods and recipes** are what the owner logs from: custom foods, cached USDA and Open Food Facts foods, and recipes, whose nutrition derives from their ingredients. Log one with \`POST /food-entries\` and \`foodId\` or \`recipeId\`.
- **Strategy**: a nutrition plan sets the goal, coaching program, and seven daily targets (Monday first) from its day until the next plan's. Per-nutrient goals set micronutrient bounds from a day on.
- **Body metrics** are visual body fat, tape measurements, and steps, one value per day and kind, beside the weigh-ins.
- **Insights** are what the app computes instead of storing, recomputed on every call: \`GET /weight-trend\` (MacroFactor's trend weight), \`GET /expenditure\` (the TDEE estimate), and \`GET /training-summary\` (sets per muscle, volume, and bests over a range). Pass \`tz\`, the owner's time zone, so days match the phone's. \`GET /export\` returns every stored row at once.

## Conventions

- Weights are always kilograms (\`weightKg\`), whatever \`settings.weightUnit\` displays. Durations are seconds; distances are meters; tape measurements are centimeters; energy is kcal.
- Nutrients are sparse maps keyed by id (\`k\` kcal, \`p\`, \`f\`, \`c\`, \`nc\` grams, USDA numbers such as \`291\` fiber). An amount eaten is the snapshot's nutrients times \`measure.servings * quantity / measure.quantity\`.
- Days are \`YYYY-MM-DD\` and never move through a time zone. Day-keyed rows (nutrition days, plans, body metrics, nutrient goals) are set with PUT, which replaces the value for that key.
- Instants are ISO 8601. Ids are UUIDs, generated by the server when you omit them; compare them case-insensitively. A create given an id that exists answers 409.
- PATCH sets only the fields you send. A JSON tree such as \`blocks\`, \`days\`, or \`equipment\` is replaced whole, so read it, change it, and send it back.
- Lists that page (\`limit\`, \`offset\`) answer \`{ total, items }\`; the others answer an array.
- Errors answer \`{ ok: false, error, issues? }\` with 400 for a bad request, 401 for a missing or revoked token, 404 for an unknown id, 409 for a conflict, and 422 for a reference to something that does not exist.

## Common tasks

- Review recent training: \`GET /sessions?limit=10\`, then \`GET /exercises/{id}/history\` for the lifts that matter, and \`GET /training-summary?from=\` per week for volume per muscle.
- Build a program: \`POST /programs\` with \`days\`, each \`{ "template": { "name", "blocks" } }\` or \`{}\` for rest, and \`"activate": true\`.
- Adjust the next workouts: \`PATCH /templates/{id}\` with the changed \`blocks\`.
- Log a workout done elsewhere: \`POST /sessions\` with \`startedAt\`, \`endedAt\`, and blocks whose sets have \`log\`.
- Review eating against targets: \`GET /food-log?from=&to=\` gives each day's totals beside its target, and \`GET /weight-trend\` and \`GET /expenditure\` show what it did.
- Log a meal: \`POST /food-entries\` per food, each with a \`food\` snapshot or a \`foodId\`, and the same \`day\` and \`minute\`.

Base URL: ${base}. The OpenAPI 3.1 document below lists every operation and schema.`;

function match(method: string, path: string) {
	for (const route of routes) {
		if (route.method !== (method as Method)) continue;
		const names: string[] = [];
		const pattern = new RegExp(
			`^${route.path.replaceAll(/\{(\w+)\}/g, (_, name: string) => (names.push(name), '([^/]+)'))}$`,
		);
		const found = pattern.exec(path);
		if (found)
			return {
				route,
				params: Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(found[index + 1]!)])),
			};
	}
	return undefined;
}

/**
 * Every `/api` route but the sync engine's. `GET /api` is the entry point: without a token it explains how to get one,
 * with a token it returns the guide, a snapshot of the owner's state, and the OpenAPI document. Every other route,
 * `/openapi.json` included, answers a bare 401 without a token.
 */
export async function handleAgent(request: Request, host: AgentHost): Promise<Response> {
	const url = new URL(request.url);
	const base = `${url.origin}/api`;
	const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '');
	const db = openDb(host.space, host.driver);

	const actor = await authenticate(request, db, host.ownerToken);
	if (!actor && request.method === 'GET' && path === '') {
		return Response.json({ name: 'A Better Me', authenticated: false, instructions: howToAuthenticate(base) });
	}
	if (!actor) {
		return Response.json(
			{ ok: false, error: 'Missing, wrong, or revoked token' },
			{ status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
		);
	}
	if (request.method === 'GET' && path === '/openapi.json') return Response.json(openApi(routes, base, guide(base)));
	if (request.method === 'GET' && path === '') {
		const tz = M.timeZone.safeParse(url.searchParams.get('tz') ?? undefined);
		if (!tz.success) return error(400, 'tz must be an IANA time zone, such as America/New_York');
		return Response.json({
			name: 'A Better Me',
			authenticated: true,
			actor,
			baseUrl: base,
			guide: guide(base),
			state: snapshot(db, tz.data, new Date().toISOString()),
			openapi: openApi(routes, base, guide(base)),
		});
	}
	const found = match(request.method, path);
	if (!found) return error(404, `No route ${request.method} /api${path}. GET ${base} lists every route.`);
	const { route, params } = found;
	try {
		let raw: unknown;
		if (route.body) {
			try {
				raw = await request.json();
			} catch {
				return error(400, 'The body must be JSON');
			}
		}
		const result = await route.run({
			db,
			params,
			query: (route.query ?? z.object({})).parse(Object.fromEntries(url.searchParams)),
			body: route.body?.parse(raw),
			now: new Date().toISOString(),
		});
		return Response.json(result);
	} catch (caught) {
		if (caught instanceof ApiError) return error(caught.status, caught.message);
		if (caught instanceof z.ZodError) {
			const issues = caught.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }));
			return error(400, 'Invalid request', issues);
		}
		throw caught;
	}
}
