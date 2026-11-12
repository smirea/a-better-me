/**
 * Preloaded first by `bun test`. Tests of dates around a daylight-saving change only cross one when the process runs
 * in a zone that has it, and a shell's zone may be UTC, so every run pins the same zone. No test means the repository
 * it runs in, so none sees git's hook environment either.
 */
import { dropGitEnv } from './git-env';

process.env.TZ = 'America/New_York';
dropGitEnv();
