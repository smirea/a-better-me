import { outlineRamble, type RambleModel, type RambleOutline, type RambleRequest } from '../../server/src/food/ramble';

/** A text parser under test: `provider:model[:thinking]`, e.g. `gemini:gemini-3.5-flash:minimal`, `xai:grok-4.20-0309-non-reasoning`. */
export function parserSpec(text: string): RambleModel {
	const [provider, model, thinking] = text.split(':');
	if (provider !== 'gemini' && provider !== 'xai') throw new Error(`unknown parser provider in ${text}`);
	return { provider, model: model!, thinking: thinking as RambleModel['thinking'] };
}

export type Parsed = { outline: RambleOutline; ms: number };

const keys = { gemini: process.env.GEMINI_API_KEY ?? null, xai: process.env.XAI_API_KEY ?? null };

/** One read of the whole transcript so far, through the server's own `outlineRamble`, on this model alone. */
export async function parse(
	spec: RambleModel,
	request: Omit<RambleRequest, 'transcript'>,
	transcript: string,
	signal?: AbortSignal,
): Promise<Parsed> {
	if (!keys[spec.provider]) throw new Error(`no key for ${spec.provider}`);
	const started = performance.now();
	const outline = await outlineRamble({ ...request, transcript }, keys, { models: [spec], signal });
	return { outline, ms: performance.now() - started };
}
