import { afterEach, expect, test } from 'bun:test';
import { handle, type App } from './api';
import { DEV_OWNER_TOKEN } from './config';
import { testServer } from './testing';

const { app: base } = testServer();
const app: App = { ...base, config: { ...base.config, githubToken: 'github-token' } };

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

type Call = { method: string; url: string; authorization: string | null; body: string };

/** Stands in for GitHub: answers as it does for the repository, an upload, an issue, and a comment. */
function fakeGitHub() {
	const calls: Call[] = [];
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const request = new Request(input, init);
		const url = new URL(request.url);
		const upload = url.hostname === 'uploads.github.com';
		calls.push({
			method: request.method,
			url: request.url,
			authorization: request.headers.get('authorization'),
			body: upload ? `${(await request.arrayBuffer()).byteLength} bytes` : await request.text(),
		});
		if (upload) return Response.json({ url: 'https://github.com/user-attachments/assets/a1' }, { status: 201 });
		if (url.pathname.endsWith('/comments')) return Response.json({ id: 1 }, { status: 201 });
		if (url.pathname.endsWith('/issues')) {
			return Response.json({ number: 7, html_url: 'https://github.com/smirea/a-better-me/issues/7' }, { status: 201 });
		}
		return Response.json({ id: 42 });
	}) as unknown as typeof fetch;
	return calls;
}

const report = {
	environment: [{ name: 'App', value: 'A Better Me 1.0' }],
	items: [
		{ number: 1, text: 'Too tall\nTrim it', title: 'Card "Steps"', code: 'App/Dashboard/StepGoalViews.swift:40' },
	],
};

function post(token: string | null, body: object = report) {
	const form = new FormData();
	form.set('id', 'post-1');
	form.set('title', 'Dashboard Feedback: 1 change');
	form.set('image', new File(['PNG'], 'feedback.png', { type: 'image/png' }));
	form.set('report', new File([JSON.stringify(body)], 'feedback.json', { type: 'application/json' }));
	const headers = token ? { authorization: `Bearer ${token}` } : undefined;
	return new Request('http://api.test/api/feedback', { method: 'POST', headers, body: form });
}

test('an owner post becomes an issue in this repository with the image, each item, and the report', async () => {
	const calls = fakeGitHub();
	const response = await handle(post(DEV_OWNER_TOKEN), app);

	expect([response.status, await response.json()]).toEqual([
		201,
		{ url: 'https://github.com/smirea/a-better-me/issues/7' },
	]);
	expect(calls.map(call => [call.method, call.url, call.authorization])).toEqual([
		['GET', 'https://api.github.com/repos/smirea/a-better-me', 'Bearer github-token'],
		[
			'POST',
			'https://uploads.github.com/user-attachments/assets?name=feedback.png&content_type=image%2Fpng&repository_id=42',
			'Bearer github-token',
		],
		['POST', 'https://api.github.com/repos/smirea/a-better-me/issues', 'Bearer github-token'],
	]);
	const issue = JSON.parse(calls[2]!.body);
	expect([issue.title, issue.labels]).toEqual(['Dashboard Feedback: 1 change', ['feedback']]);
	expect(issue.body).toStartWith(
		[
			'![Dashboard Feedback: 1 change](https://github.com/user-attachments/assets/a1)',
			'**1. Card "Steps"** · `App/Dashboard/StepGoalViews.swift:40`',
			'> Too tall\n> Trim it',
			'App: A Better Me 1.0',
			'<!-- feedback post post-1 -->',
		].join('\n\n'),
	);
	expect(issue.body).toContain(`<summary>feedback.json</summary>\n\n\`\`\`json\n${JSON.stringify(report)}\n\`\`\``);
});

test('a post without the owner token reaches neither GitHub nor the issue list', async () => {
	const calls = fakeGitHub();
	for (const token of [null, 'wrong']) {
		const response = await handle(post(token), app);
		expect([response.status, await response.json()]).toEqual([401, { message: 'Missing or wrong owner token.' }]);
	}
	expect(calls).toEqual([]);
});

test('a server without a GitHub token says so in the editor', async () => {
	const response = await handle(post(DEV_OWNER_TOKEN), base);
	expect([response.status, await response.json()]).toEqual([
		503,
		{ message: 'Set GITHUB_TOKEN on the server to file feedback issues.' },
	]);
});

test('a report too long for the body goes into comments that join back into the file', async () => {
	const calls = fakeGitHub();
	const long = { ...report, padding: 'x'.repeat(130_000) };
	expect((await handle(post(DEV_OWNER_TOKEN, long), app)).status).toBe(201);

	const comments = calls.filter(call => call.url.endsWith('/issues/7/comments'));
	expect(comments.length).toBe(3);
	const parts = comments.map(call => /```json\n([\s\S]*)\n```/.exec(JSON.parse(call.body).body)![1]);
	expect(parts.join('')).toBe(JSON.stringify(long));
});

test('a GitHub failure is a 502 whose message the editor shows', async () => {
	globalThis.fetch = (async () => new Response('Bad credentials', { status: 401 })) as unknown as typeof fetch;
	const response = await handle(post(DEV_OWNER_TOKEN), app);
	expect([response.status, await response.json()]).toEqual([
		502,
		{ message: 'GitHub answered 401 to GET /repos/smirea/a-better-me: Bad credentials' },
	]);
});
