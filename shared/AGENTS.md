# Shared contracts

- Keep shared types and domain helpers here. Both TypeScript apps resolve `shared/*` through the root tsconfig.
- Keep this folder independent of app-specific environment readers, server-only code, and browser frameworks. Each app owns its env-manager target.
