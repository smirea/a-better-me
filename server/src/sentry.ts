/**
 * What both hosts' Sentry SDKs share. A message without a stack trace keeps its own text as the issue title, not the
 * calling function's name. Dedupe drops an event equal to the one before it, which is every refused write after the
 * first in a run.
 */
export const SENTRY_DEFAULTS = { attachStacktrace: false } as const;
export const withoutDedupe = <Integration extends { name: string }>(defaults: Integration[]) =>
	defaults.filter(integration => integration.name !== 'Dedupe');
