import { defineConfig } from 'vite';
import env from './src/env.ts';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';

const allowedHosts = env.CLIENT_HOST ? [env.CLIENT_HOST] : undefined;

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	server: {
		host: '127.0.0.1',
		allowedHosts,
		port: env.CLIENT_PORT,
		strictPort: true,
		proxy: {
			'/api': {
				target: env.API_URL,
				changeOrigin: true,
				secure: false,
				rewrite: (path: string) => path.replace(/^\/api/, ''),
			},
		},
	},
	plugins: [
		tanstackRouter({
			target: 'react',
			autoCodeSplitting: true,
		}) as any,
		react(),
		tailwindcss() as any,
	],
});
