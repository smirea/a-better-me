/** A request the route refuses, answered as `{ ok: false, error }` with its status. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export const errorResponse = (status: number, message: string, issues?: unknown) =>
	Response.json({ ok: false, error: message, ...(issues !== undefined && { issues }) }, { status });
