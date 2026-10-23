import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './shared/db/schema.ts',
	out: './server/drizzle',
});
