# Web client

- React and TanStack Router live in `src/`; Vite generates `src/routeTree.gen.ts`. Styling uses Tailwind CSS.
- Run `bun run start:client` from the root, or `bun run start` here. Vite reads this target's generated `.env.local`; `src/env.ts` is only for Node-side Vite configuration.
- Browser API requests use `/api/*`; Vite proxies to the root schema's `API_URL` and strips `/api`.
- Edit schema and values at the repo root. Run `env-manager gen --local` to update child outputs; do not maintain a child `.env` schema or import the env reader into browser code.
