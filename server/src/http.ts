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

/**
 * Bun 1.4 resets the connection when a response leaves before the request body was read, so a client would see
 * ECONNRESET, which reads as offline, instead of the error that tells it why.
 */
export async function drain(request: Request): Promise<void> {
	if (request.body && !request.bodyUsed) await request.arrayBuffer();
}
