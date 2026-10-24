/**
 * Writes the iOS client's schema from `shared/db/schema.ts`: `bun run generate`. Unlike the apps' other generated
 * files, the output is committed, because Xcode and CI build the app without running Bun first.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generate } from 'sync-engine/schema';
import { schema } from '../shared/db/schema';

export const SWIFT_SCHEMA = 'app-ios/Sources/App/Sync/Generated/SyncSchema.swift';

if (import.meta.main) {
	const swift = join(import.meta.dir, '..', SWIFT_SCHEMA);
	mkdirSync(dirname(swift), { recursive: true });
	generate({ schema, swift });
	console.log(`Wrote ${SWIFT_SCHEMA}`);
}
