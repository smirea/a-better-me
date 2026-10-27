import { join } from 'node:path';
import { concatenate } from '../../server/src/assets';

/**
 * Writes the catalog's instruction and article Markdown as `markdown.pack`, the UTF-8 texts back to back, and
 * `markdown.json`, each key's `[offset, size]` in bytes. The app memory-maps the pack and decodes one text per lookup.
 * Keys are `Instructions/<exercise id>` and `Articles/<article id>`.
 */
export async function writeMarkdownPack(dir: string, texts: Map<string, string>) {
	const encoder = new TextEncoder();
	const packed = concatenate(
		[...texts.keys()].toSorted().map(key => ({ path: key, bytes: encoder.encode(texts.get(key)!) })),
	);
	await Bun.write(join(dir, 'markdown.pack'), packed.bytes);
	await Bun.write(
		join(dir, 'markdown.json'),
		`${JSON.stringify(Object.fromEntries(packed.files.map(file => [file.path, [file.offset, file.size]])))}\n`,
	);
}
