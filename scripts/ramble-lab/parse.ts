import { outlineRamble, type RambleModel, type RambleOutline, type RambleRequest } from '../../server/src/food/ramble';

/** A Gemini text parser under test: `model[:thinking]`, e.g. `gemini-3.5-flash:minimal`. */
export function parserSpec(text: string): RambleModel {
	const [model, thinking] = text.replace(/^gemini:/, '').split(':');
	return { model: model!, thinking: thinking as RambleModel['thinking'] };
}

export type Parsed = { outline: RambleOutline; ms: number };

/** One read of the whole transcript so far, through the server's own `outlineRamble`. */
export async function parse(
	spec: RambleModel,
	request: Omit<RambleRequest, 'transcript'>,
	transcript: string,
	signal?: AbortSignal,
): Promise<Parsed> {
	const key = process.env.GEMINI_API_KEY;
	if (!key) throw new Error('GEMINI_API_KEY is required');
	const started = performance.now();
	const outline = await outlineRamble({ ...request, transcript }, key, { model: spec, signal });
	return { outline, ms: performance.now() - started };
}
