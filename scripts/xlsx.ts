/**
 * Just enough of an `.xlsx` reader and writer for the MacroFactor importer and its fixture: a zip of XML parts, read
 * through the central directory with `node:zlib`, and each sheet as rows of strings, numbers, or nulls. Styles,
 * formulas, and dates as dates are out of scope: MacroFactor's dates are plain serial numbers or text.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib';

export type Cell = string | number | null;
export type Sheet = Cell[][];

function unzip(data: Uint8Array): Map<string, Uint8Array> {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	let end = data.length - 22;
	while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
	if (end < 0) throw new Error('Not an xlsx file: no zip directory');
	const count = view.getUint16(end + 10, true);
	let at = view.getUint32(end + 16, true);
	const files = new Map<string, Uint8Array>();
	for (let index = 0; index < count; index++) {
		const method = view.getUint16(at + 10, true);
		const size = view.getUint32(at + 20, true);
		const nameLength = view.getUint16(at + 28, true);
		const extraLength = view.getUint16(at + 30, true);
		const commentLength = view.getUint16(at + 32, true);
		const local = view.getUint32(at + 42, true);
		const name = new TextDecoder().decode(data.subarray(at + 46, at + 46 + nameLength));
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const raw = data.subarray(start, start + size);
		files.set(name, method === 0 ? raw : new Uint8Array(inflateRawSync(raw)));
		at += 46 + nameLength + extraLength + commentLength;
	}
	return files;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (text: string) =>
	text.replaceAll(/&(#x?[0-9a-f]+|\w+);/gi, (whole, name: string) =>
		name.startsWith('#')
			? String.fromCodePoint(Number.parseInt(name.slice(name[1] === 'x' ? 2 : 1), name[1] === 'x' ? 16 : 10))
			: (ENTITIES[name] ?? whole),
	);
const escape = (text: string) =>
	text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const attribute = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
/** Every `<t>` inside, which joins a rich-text string's runs. */
const text = (xml: string) =>
	[...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(([, inner]) => unescape(inner!)).join('');

function column(reference: string) {
	let index = 0;
	for (const letter of /^[A-Z]+/.exec(reference)![0]) index = index * 26 + letter.charCodeAt(0) - 64;
	return index - 1;
}

function parseSheet(xml: string, shared: string[]): Sheet {
	const rows: Sheet = [];
	for (const [, attributes, body] of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
		const row: Cell[] = [];
		for (const [, tag, inner = ''] of (body ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
			const type = attribute(tag!, 't');
			const value = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
			const cell =
				type === 's'
					? shared[Number(value)]!
					: type === 'inlineStr'
						? text(inner)
						: type === 'str' || type === 'e'
							? unescape(value ?? '')
							: type === 'b'
								? Number(value)
								: value === undefined || value === ''
									? null
									: Number(value);
			row[column(attribute(tag!, 'r')!)] = cell === '' ? null : cell;
		}
		rows[Number(attribute(attributes!, 'r')) - 1] = Array.from(row, cell => cell ?? null);
	}
	return Array.from(rows, row => row ?? []);
}

/** Every sheet by name, in workbook order. */
export function readXlsx(data: Uint8Array): Map<string, Sheet> {
	const files = unzip(data);
	const read = (path: string) => {
		const file = files.get(path);
		return file ? new TextDecoder().decode(file) : undefined;
	};
	const workbook = read('xl/workbook.xml');
	const relations = read('xl/_rels/workbook.xml.rels');
	if (!workbook || !relations) throw new Error('Not an xlsx file: no workbook');
	const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) => text(si!));
	const targets = new Map(
		[...relations.matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [attribute(tag, 'Id'), attribute(tag, 'Target')]),
	);
	const sheets = new Map<string, Sheet>();
	for (const [tag] of workbook.matchAll(/<sheet\b[^>]*>/g)) {
		const target = targets.get(attribute(tag, 'r:id'))!.replace(/^\/?(xl\/)?/, 'xl/');
		sheets.set(unescape(attribute(tag, 'name')!), parseSheet(read(target) ?? '', shared));
	}
	return sheets;
}

function crc32(data: Uint8Array) {
	let crc = ~0;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
	}
	return ~crc >>> 0;
}

function zip(files: [string, string][]): Uint8Array {
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;
	for (const [name, content] of files) {
		const raw = new TextEncoder().encode(content);
		const packed = deflateRawSync(raw);
		const path = new TextEncoder().encode(name);
		const header = (signature: number, size: number) => {
			const bytes = new Uint8Array(size + path.length);
			const view = new DataView(bytes.buffer);
			view.setUint32(0, signature, true);
			return { bytes, view };
		};
		const local = header(0x04034b50, 30);
		local.view.setUint16(4, 20, true);
		local.view.setUint16(8, 8, true);
		local.view.setUint32(14, crc32(raw), true);
		local.view.setUint32(18, packed.length, true);
		local.view.setUint32(22, raw.length, true);
		local.view.setUint16(26, path.length, true);
		local.bytes.set(path, 30);
		const central = header(0x02014b50, 46);
		central.view.setUint16(6, 20, true);
		central.view.setUint16(10, 8, true);
		central.view.setUint32(16, crc32(raw), true);
		central.view.setUint32(20, packed.length, true);
		central.view.setUint32(24, raw.length, true);
		central.view.setUint16(28, path.length, true);
		central.view.setUint32(42, offset, true);
		central.bytes.set(path, 46);
		locals.push(local.bytes, packed);
		centrals.push(central.bytes);
		offset += local.bytes.length + packed.length;
	}
	const directory = centrals.reduce((size, part) => size + part.length, 0);
	const end = new Uint8Array(22);
	const view = new DataView(end.buffer);
	view.setUint32(0, 0x06054b50, true);
	view.setUint16(8, files.length, true);
	view.setUint16(10, files.length, true);
	view.setUint32(12, directory, true);
	view.setUint32(16, offset, true);
	return new Uint8Array(Buffer.concat([...locals, ...centrals, end]));
}

const letters = (index: number): string =>
	(index >= 26 ? letters(Math.floor(index / 26) - 1) : '') + String.fromCharCode(65 + (index % 26));

/** A workbook MacroFactor's way: strings shared, numbers plain. For fixtures. */
export function writeXlsx(sheets: Record<string, Sheet>): Uint8Array {
	const shared: string[] = [];
	const names = Object.keys(sheets);
	const sheetXml = (rows: Sheet) =>
		rows
			.map((row, r) => {
				const cells = row.map((cell, c) => {
					const reference = `${letters(c)}${r + 1}`;
					if (cell === null) return '';
					if (typeof cell === 'number') return `<c r="${reference}" t="n"><v>${cell}</v></c>`;
					shared.push(cell);
					return `<c r="${reference}" t="s"><v>${shared.length - 1}</v></c>`;
				});
				return `<row r="${r + 1}">${cells.join('')}</row>`;
			})
			.join('');
	const worksheets = names.map((name, index): [string, string] => [
		`xl/worksheets/sheet${index + 1}.xml`,
		`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetXml(sheets[name]!)}</sheetData></worksheet>`,
	]);
	const ns = 'http://schemas.openxmlformats.org';
	return zip([
		[
			'[Content_Types].xml',
			`<?xml version="1.0"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
		],
		[
			'_rels/.rels',
			`<?xml version="1.0"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
		],
		[
			'xl/workbook.xml',
			`<?xml version="1.0"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${names.map((name, index) => `<sheet name="${escape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`,
		],
		[
			'xl/_rels/workbook.xml.rels',
			`<?xml version="1.0"?><Relationships xmlns="${ns}/package/2006/relationships">${names.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${names.length + 1}" Type="${ns}/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
		],
		...worksheets,
		[
			'xl/sharedStrings.xml',
			`<?xml version="1.0"?><sst xmlns="${ns}/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map(value => `<si><t xml:space="preserve">${escape(value)}</t></si>`).join('')}</sst>`,
		],
	]);
}
