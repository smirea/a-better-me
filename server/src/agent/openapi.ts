import { z } from 'zod';
import type { Route } from './routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Converts every schema of one direction in a single pass, so each schema with a `meta` id becomes one shared component
 * instead of a copy per operation. Requests and responses differ where a default makes a field optional on the way
 * in, so an input component that shares a name with an output one gets an `Input` suffix. Generated ids and
 * timestamps are dropped from the defaults.
 */
function convert(io: 'input' | 'output', entries: Record<string, z.ZodType>, taken = new Set<string>()) {
	const rename = (name: string) => (taken.has(name) ? `${name}Input` : name);
	const json = z.toJSONSchema(z.object(entries), {
		io,
		target: 'draft-2020-12',
		unrepresentable: 'any',
		override: ({ jsonSchema }) => {
			if (typeof jsonSchema.default === 'string' && (UUID.test(jsonSchema.default) || ISO.test(jsonSchema.default))) {
				delete jsonSchema.default;
			}
		},
	});
	const text = JSON.stringify(json).replaceAll(
		/"#\/\$defs\/([^"]+)"/g,
		(_, name: string) => `"#/components/schemas/${rename(name)}"`,
	);
	const { properties, $defs = {} } = JSON.parse(text) as {
		properties: Record<string, object>;
		$defs?: Record<string, object>;
	};
	const components = Object.fromEntries(Object.entries($defs).map(([name, schema]) => [rename(name), schema]));
	return { properties, components };
}

const ErrorBody = {
	type: 'object',
	properties: { ok: { const: false }, error: { type: 'string' }, issues: { type: 'array' } },
	required: ['ok', 'error'],
};

export function openApi(routes: Route[], baseUrl: string, guide: string) {
	const key = (route: Route, part: string) => `${route.method} ${route.path} ${part}`;
	const outputs = convert(
		'output',
		Object.fromEntries(
			routes.flatMap(route => [
				[key(route, 'response'), route.response],
				...Object.entries(route.query?.shape ?? {}).map(([name, schema]) => [key(route, `query ${name}`), schema]),
			]),
		),
	);
	const inputs = convert(
		'input',
		Object.fromEntries(routes.flatMap(route => (route.body ? [[key(route, 'body'), route.body]] : []))),
		new Set(Object.keys(outputs.components)),
	);

	const paths: Record<string, Record<string, unknown>> = {};
	for (const route of routes) {
		const pathParams = [...route.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
			name,
			in: 'path',
			required: true,
			schema: { type: 'string' },
		}));
		const queryParams = Object.keys(route.query?.shape ?? {}).map(name => {
			const { description, ...schema } = outputs.properties[key(route, `query ${name}`)] as { description?: string };
			return { name, in: 'query', required: false, description, schema };
		});
		(paths[route.path] ??= {})[route.method.toLowerCase()] = {
			operationId: `${route.method.toLowerCase()} ${route.path.replaceAll(/\{(\w+)\}/g, 'by $1')}`.replaceAll(
				/[^a-z]+(\w)/gi,
				(_, letter: string) => letter.toUpperCase(),
			),
			tags: [route.tag],
			summary: route.summary,
			description: route.description,
			parameters: [...pathParams, ...queryParams],
			...(route.body && {
				requestBody: {
					required: true,
					content: { 'application/json': { schema: inputs.properties[key(route, 'body')] } },
				},
			}),
			responses: {
				200: {
					description: 'OK',
					content: { 'application/json': { schema: outputs.properties[key(route, 'response')] } },
				},
				'4XX': {
					description: 'Error',
					content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
				},
			},
		};
	}

	return {
		openapi: '3.1.0',
		info: { title: 'A Better Me', version: '1', description: guide },
		servers: [{ url: baseUrl }],
		security: [{ bearer: [] }],
		paths,
		components: {
			securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'A bot token (`abm_...`).' } },
			schemas: { ...outputs.components, ...inputs.components, Error: ErrorBody },
		},
	};
}
