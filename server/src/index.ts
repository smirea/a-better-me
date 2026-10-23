import { config } from './config';

const server = Bun.serve({
	development: config.environment === 'development',
	idleTimeout: 120,
	port: config.port,
	routes: {
		'/status': Response.json({ ok: true }),
		'/*': Response.json({ ok: false, error: 'Not found' }, { status: 404 }),
	},
});

console.log('Server running at:', server.url);
