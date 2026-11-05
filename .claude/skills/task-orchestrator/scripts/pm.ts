#!/usr/bin/env bun
// Calls ProcrastiMate's production agent API as the AI account. A Better Me's tasks live there, in the
// "a better me" project; the credentials live in the ProcrastiMate checkout, not in this repo's env.
//   pm.ts <METHOD> <path> [json body | - for stdin]     raw call, e.g. pm.ts GET /view
//   pm.ts complete <task id> <pr url> [note]            comment "<pr url>\n<note>", then complete; safe to rerun
//   pm.ts file <project name or id> <title> [notes] [--section id] [--parent id]
//                                                       add a task unless an open one in the project has this title;
//                                                       prints "<id> <public link>"; safe to rerun
//   pm.ts link <task id>...                             print "<id> <public read-only link>" per task
//   pm.ts images <task id> <dir>                        download the task's images as <dir>/<task id>-<n>.<ext> and its files
//                                                       as <dir>/<task id>-<name>, print paths
//   pm.ts merged <pr url> <worktree> <task id>... [--note text]
//                                                       complete each task with the PR, then tear down the worktree; safe to rerun
//   pm.ts new <project name or id> <session file>       open tasks whose id prefix the session file doesn't mention
//   pm.ts tasks <project name or id>                    open tasks with section, parent, priority, label names, notes
//   pm.ts comments <task id>                            the task's comments, oldest first
//   pm.ts label <task id> +<name>|-<name>...            add or remove labels by name, keeping the others
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Named = { id: string; name: string };
type Attachment = { id: string; name?: string; bytes?: number };
type Task = {
	id: string;
	title: string;
	notes: string | null;
	projectId: string;
	sectionId: string | null;
	parentId: string | null;
	priority: number;
	labelIds: string[];
	attachments: Attachment[];
	completedAt: number | null;
};
type View = { projects: Named[]; labels: Named[]; sections: Named[]; tasks: Task[] };
type Comment = { body: string; createdAt: number; author: { name: string; kind: string } };

const envFile = join(process.env.HOME!, 'code/procrastimate/.env.local');
const fix = `run 'env-manager down' in ${dirname(envFile)} (never 'up')`;
if (!existsSync(envFile)) fail(`no ${envFile}; ${fix}`);
const env = Object.fromEntries(
	[...readFileSync(envFile, 'utf8').matchAll(/^(\w+)=(?:'([^']*)'|"([^"]*)"|([^\s#]*))/gm)].map(m => [
		m[1],
		m[2] ?? m[3] ?? m[4],
	]),
);
const apiUrl = env.APP_BOT_API_URL || fail(`APP_BOT_API_URL missing in ${envFile}; ${fix}`);
const token = env.APP_BOT_TOKEN || fail(`APP_BOT_TOKEN missing in ${envFile}; ${fix}`);

function fail(message: string): never {
	console.error(`pm: ${message}`);
	process.exit(1);
}

async function call(method: string, path: string, body?: unknown): Promise<Response> {
	// Reads retry on transient errors; writes don't, because a retried write can land twice.
	for (let attempt = 0; ; attempt++) {
		try {
			const res = await fetch(apiUrl + path, {
				method,
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
			});
			if (res.ok) return res;
			const error = new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
			if (method !== 'GET' || attempt >= 3 || res.status < 500) throw Object.assign(error, { final: true });
		} catch (error) {
			if (method !== 'GET' || attempt >= 3 || (error as { final?: boolean }).final) throw error;
		}
		await Bun.sleep(1000 * (attempt + 1));
	}
}

const api = async <T>(method: string, path: string, body?: unknown) => (await call(method, path, body)).json() as T;
const view = () => api<View>('GET', '/view');
const link = async (id: string) => (await api<{ url: string }>('POST', '/links', { target: { kind: 'task', id } })).url;

function projectId(v: View, nameOrId: string): string {
	const matches = v.projects.filter(p => p.id === nameOrId || p.name === nameOrId);
	if (matches.length !== 1) fail(`expected one project named ${nameOrId}, found ${matches.length}`);
	return matches[0]!.id;
}

function openTasks(v: View, project: string): Task[] {
	const pid = projectId(v, project);
	return v.tasks.filter(t => t.projectId === pid && t.completedAt === null);
}

async function complete(task: string, pr: string, note: string) {
	const { comments } = await api<{ comments: Comment[] }>('GET', `/comments?id=${task}`);
	if (!comments.some(c => c.body.startsWith(pr)))
		await api('POST', '/comments', { taskId: task, body: note ? `${pr}\n${note}` : pr });
	if ((await view()).tasks.some(t => t.id === task && t.completedAt === null))
		await call('POST', `/tasks/complete?id=${task}`);
	console.log(`completed ${task}`);
}

function flags(args: string[], names: string[]) {
	const values: Record<string, string> = {};
	const rest: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!;
		if (!arg.startsWith('--')) rest.push(arg);
		else if (names.includes(arg.slice(2)) && args[i + 1] !== undefined) values[arg.slice(2)] = args[++i]!;
		else fail(`unknown flag or missing value: '${arg}'`);
	}
	return { values, rest };
}

const [command = '', ...args] = Bun.argv.slice(2);
await run().catch((error: Error) => fail(error.message));

async function run() {
	switch (command) {
		case 'complete': {
			const [task, pr, note = ''] = args;
			if (!task || !pr) fail('usage: pm.ts complete <task id> <pr url> [note]');
			await complete(task, pr, note);
			break;
		}
		case 'file': {
			const [project, title, ...more] = args;
			if (!project || !title) fail('usage: pm.ts file <project> <title> [notes] [--section id] [--parent id]');
			const { values, rest } = flags(more, ['section', 'parent']);
			if (rest.length > 1) fail(`notes given more than once: ${rest.map(r => `'${r}'`).join(', ')}`);
			const pid = projectId(await view(), project);
			const find = async () =>
				(await view()).tasks.find(t => t.projectId === pid && t.title === title && t.completedAt === null)?.id;
			const body = {
				projectId: pid,
				title,
				...(rest[0] && { notes: rest[0] }),
				...(values.section && { sectionId: values.section }),
				...(values.parent && { parentId: values.parent }),
			};
			const post = async () => (await api<{ id: string }>('POST', '/tasks', body)).id;
			// A failed POST may still have created the task, so look again before the one retry.
			const id = (await find()) ?? (await post().catch(find)) ?? (await post());
			console.log(`${id} ${await link(id)}`);
			break;
		}
		case 'link':
			for (const task of args) console.log(`${task} ${await link(task)}`);
			break;
		case 'images': {
			const [task, dir] = args;
			if (!task || !dir) fail('usage: pm.ts images <task id> <dir>');
			mkdirSync(dir, { recursive: true });
			const attachments = (await view()).tasks.find(t => t.id === task)?.attachments ?? fail(`no task ${task}`);
			let n = 0;
			for (const { id, name, bytes = 0 } of attachments) {
				if (!name) {
					const res = await call('GET', `/images?id=${id}&size=full`);
					const ext = (res.headers.get('content-type') ?? 'image/jpeg').replace('image/', '').replace('jpeg', 'jpg');
					const out = join(dir, `${task}-${++n}.${ext}`);
					await Bun.write(out, res);
					console.log(out);
					continue;
				}
				const parts: ArrayBuffer[] = [];
				for (let size = 0, part = 0; size < bytes; part++) {
					const chunk = await (await call('GET', `/images?id=${id}&size=part${part}`)).arrayBuffer();
					if (chunk.byteLength === 0) fail(`attachment ${id} ended at ${size} of ${bytes} bytes`);
					parts.push(chunk);
					size += chunk.byteLength;
				}
				const out = join(dir, `${task}-${name}`);
				await Bun.write(out, new Blob(parts));
				console.log(out);
			}
			break;
		}
		case 'merged': {
			const [pr, worktree, ...more] = args;
			const { values, rest: tasks } = flags(more, ['note']);
			if (!pr || !worktree || tasks.length === 0)
				fail('usage: pm.ts merged <pr url> <worktree> <task id>... [--note text]');
			for (const task of tasks) await complete(task, pr, values.note ?? '');
			// Teardown removes the worktree, so a rerun after it finished finds nothing left to remove.
			if (existsSync(worktree)) {
				const commonDir = Bun.spawnSync(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir']);
				const root = dirname(commonDir.stdout.toString().trim());
				const teardown = Bun.spawnSync(['bun', 'scripts/teardown-worktree.ts', worktree], {
					cwd: root,
					stderr: 'inherit',
				});
				console.log(teardown.stdout.toString().trim().split('\n').at(-1));
				if (teardown.exitCode !== 0) process.exit(teardown.exitCode);
			}
			break;
		}
		case 'new': {
			const [project, session] = args;
			if (!project || !session) fail('usage: pm.ts new <project> <session file>');
			const known = readFileSync(session, 'utf8');
			for (const t of openTasks(await view(), project)) if (!known.includes(t.id.slice(0, 8))) console.log(t.id);
			break;
		}
		case 'tasks': {
			const v = await view();
			const names = (list: Named[]) => new Map(list.map(x => [x.id, x.name]));
			const labels = names(v.labels);
			const sections = names(v.sections);
			for (const t of openTasks(v, args[0] ?? fail('usage: pm.ts tasks <project>'))) {
				console.log(
					`${t.id} p${t.priority} section=${sections.get(t.sectionId ?? '') ?? '-'} parent=${t.parentId ?? '-'}` +
						` labels=${t.labelIds.map(id => labels.get(id)).join(',')} attachments=${t.attachments.length}`,
				);
				console.log(`  ${t.title}`);
				if (t.notes) console.log(`  ${t.notes.replaceAll('\n', '\n  ')}`);
			}
			break;
		}
		case 'comments': {
			const { comments } = await api<{ comments: Comment[] }>(
				'GET',
				`/comments?id=${args[0] ?? fail('usage: pm.ts comments <task id>')}`,
			);
			for (const c of comments.toSorted((a, b) => a.createdAt - b.createdAt))
				console.log(
					`[${new Date(c.createdAt).toISOString().slice(0, 19)}Z ${c.author.name} (${c.author.kind})] ${c.body}`,
				);
			break;
		}
		case 'label': {
			const [task, ...changes] = args;
			const v = await view();
			const ids = new Set(v.tasks.find(t => t.id === task)?.labelIds ?? fail(`no task ${task}`));
			for (const change of changes) {
				if (!/^[+-]./.test(change)) fail(`label changes look like +name or -name, got '${change}'`);
				const name = change.slice(1);
				const id =
					v.labels.find(l => l.name === name)?.id ??
					fail(`no label '${name}'; the AI account can't create labels, ask Stefan to`);
				if (change[0] === '+') ids.add(id);
				else ids.delete(id);
			}
			const updated = await api<Task>('PATCH', `/tasks?id=${task}`, { labelIds: [...ids] });
			console.log(JSON.stringify({ id: updated.id, labelIds: updated.labelIds }));
			break;
		}
		default: {
			const [path, body] = args;
			if (!/^[A-Z]+$/.test(command) || !path) fail('usage: pm.ts <METHOD> <path> [json body | -]');
			const res = await call(command, path, body === '-' ? await Bun.stdin.text() : body);
			process.stdout.write(await res.text());
		}
	}
}
