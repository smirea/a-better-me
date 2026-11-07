import { z } from 'zod';
import { ApiError } from '../http';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GeminiAnswer = z.object({
	candidates: z
		.array(
			z.object({
				content: z
					.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) })
					.optional(),
			}),
		)
		.optional(),
	promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

/**
 * One `generateContent` call whose answer is JSON of `schema`. Every way Gemini fails is a 502, except a refused
 * prompt, which is the request's fault (422).
 */
export async function generateJson<T>(
	model: string,
	request: Record<string, unknown>,
	schema: z.ZodType<T>,
	{ apiKey, signal }: { apiKey: string; signal: AbortSignal },
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
			body: JSON.stringify(request),
			signal,
		});
	} catch (error) {
		throw new ApiError(502, `Gemini is unreachable: ${String(error)}`);
	}
	if (!response.ok) throw new ApiError(502, `Gemini answered ${response.status}: ${await response.text()}`);
	const body = await response.text();
	let answer: z.output<typeof GeminiAnswer>;
	try {
		answer = GeminiAnswer.parse(JSON.parse(body));
	} catch {
		throw new ApiError(502, `Gemini's response is not a generateContent answer: ${body.slice(0, 200)}`);
	}
	if (answer.promptFeedback?.blockReason) {
		throw new ApiError(422, `Gemini declined the request: ${answer.promptFeedback.blockReason}`);
	}
	const text = answer.candidates?.[0]?.content?.parts
		.filter(part => !part.thought)
		.map(part => part.text ?? '')
		.join('');
	if (!text) throw new ApiError(502, 'Gemini returned no answer');
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		throw new ApiError(502, `Gemini's answer is not JSON: ${text.slice(0, 200)}`);
	}
	const parsed = schema.safeParse(json);
	if (!parsed.success) throw new ApiError(502, `Gemini's answer does not fit the schema: ${parsed.error.message}`);
	return parsed.data;
}
