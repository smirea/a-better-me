import env from './env';

const server = Bun.serve({
	development: true,
	idleTimeout: 120,
	port: env.API_PORT,
	routes: {
		'/status': Response.json({ ok: true }),
		'/*': Response.json({ ok: false, error: 'Not found' }, { status: 404 }),
	},
});

console.log('Server running at:', server.url);
