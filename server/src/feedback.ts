/**
 * The Feedback editor's webhook (`smirea/feedback-engine`, `docs/webhooks.md`): the Share menu's GitHub Issue entry
 * posts the image export and `feedback.json` here, and each post becomes an issue in this repository. Ported from
 * that repository's `examples/github-webhook/worker.ts`, with the owner token as its key.
 */
export const FEEDBACK_ROUTE = 'POST /api/feedback';

const REPO = 'smirea/a-better-me';
const LABELS = ['feedback'];

/** GitHub's limit for an issue's body and for a comment is 65,536 characters. */
const BODY_LIMIT = 65_000;

type Report = {
	environment: { name: string; value: string }[];
	items: { number: number; text: string; title: string; code?: string }[];
};

/** The editor shows a 2xx `url` as the toast's link, and a failure's `message` after the webhook's name. */
export const feedbackAnswer = (status: number, body: { url: string } | { message: string }) =>
	Response.json(body, { status });

async function github(token: string, method: string, url: string, body?: BodyInit, type = 'application/json') {
	const response = await fetch(url, {
		method,
		body,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'a-better-me-feedback',
			...(body ? { 'Content-Type': type } : {}),
		},
	});
	if (!response.ok) {
		const text = (await response.text()).slice(0, 300);
		throw new Error(`GitHub answered ${response.status} to ${method} ${new URL(url).pathname}: ${text}`);
	}
	return (await response.json()) as Record<string, unknown>;
}

/** A fence longer than any run of backticks inside, so the text cannot close it. */
function fenced(text: string, language = '') {
	const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map(run => run.length));
	const fence = '`'.repeat(Math.max(3, longest + 1));
	return `${fence}${language}\n${text}\n${fence}`;
}

const quoted = (text: string) =>
	text
		.split(/\r?\n/)
		.map(line => `> ${line}`)
		.join('\n');

const collapsed = (summary: string, text: string) =>
	`<details>\n<summary>${summary}</summary>\n\n${fenced(text, 'json')}\n\n</details>`;

function issueBody(id: string, title: string, image: string, report: Report) {
	const items = report.items.map(
		item => `**${item.number}. ${item.title}**${item.code ? ` · \`${item.code}\`` : ''}\n\n${quoted(item.text)}`,
	);
	const environment = report.environment.map(entry => `${entry.name}: ${entry.value}`).join(' · ');
	return [`![${title}](${image})`, ...items, environment, `<!-- feedback post ${id} -->`].filter(Boolean).join('\n\n');
}

/** Runs after the owner check in `api.ts`. */
export async function fileFeedbackIssue(request: Request, token: string): Promise<Response> {
	const form = await request.formData().catch(() => undefined);
	const [id, title, image, file] = ['id', 'title', 'image', 'report'].map(name => form?.get(name));
	if (typeof id !== 'string' || typeof title !== 'string' || !(image instanceof File) || !(file instanceof File)) {
		return feedbackAnswer(400, { message: 'Send multipart/form-data with id, title, image, and report.' });
	}
	try {
		const json = await file.text();
		const report = JSON.parse(json) as Report;
		const api = `https://api.github.com/repos/${REPO}`;
		const repository = await github(token, 'GET', api);
		// The endpoint the GitHub CLI's `--attach` uses. It takes a token that can write to the repository.
		const upload = new URL('https://uploads.github.com/user-attachments/assets');
		upload.search = String(
			new URLSearchParams({ name: 'feedback.png', content_type: 'image/png', repository_id: String(repository.id) }),
		);
		const asset = await github(token, 'POST', upload.href, await image.arrayBuffer(), 'application/octet-stream');

		const body = issueBody(id, title, asset.url as string, report);
		const whole = `${body}\n\n${collapsed('feedback.json', json)}`;
		const issue = await github(
			token,
			'POST',
			`${api}/issues`,
			JSON.stringify({ title, body: whole.length <= BODY_LIMIT ? whole : body, labels: LABELS }),
		);
		// A report too long for the issue's body goes into comments, in parts that join back into the file.
		if (whole.length > BODY_LIMIT) {
			const size = BODY_LIMIT - 1000;
			const parts = Math.ceil(json.length / size);
			for (let part = 0; part < parts; part++) {
				const comment = collapsed(
					`feedback.json, part ${part + 1} of ${parts}`,
					json.slice(part * size, (part + 1) * size),
				);
				await github(token, 'POST', `${api}/issues/${issue.number}/comments`, JSON.stringify({ body: comment }));
			}
		}
		return feedbackAnswer(201, { url: issue.html_url as string });
	} catch (error) {
		return feedbackAnswer(502, { message: (error as Error).message });
	}
}
