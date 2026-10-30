import type { SttEvent } from '../types';

// Bun supports handshake headers; the ambient DOM constructor only declares subprotocols.
const BunWebSocket = WebSocket as unknown as new (url: URL, options: { headers: Record<string, string> }) => WebSocket;

export type Trace = { at: number; message: Record<string, any> };
export type Sink = {
	now(): number;
	event(kind: SttEvent['kind'], text: string, audioEnd?: number): void;
	trace(message: Record<string, any>): void;
	fail(error: unknown): void;
};
export type Session = { audio(pcm: Uint8Array): void; finish(): Promise<void>; close(): void };
export const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>(r => {
		resolve = r;
	});
	return { promise, resolve };
};
export async function within<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(label)), ms);
			}),
		]);
	} finally {
		clearTimeout(timer!);
	}
}
export async function socketSession(
	url: URL,
	headers: Record<string, string>,
	readyType: string,
	sink: Sink,
	receive: (message: Record<string, any>, done: () => void) => void,
	audio: (socket: WebSocket, pcm: Uint8Array) => void,
	end: (socket: WebSocket) => void,
): Promise<Session> {
	const ready = deferred();
	const done = deferred();
	let started = false;
	let ending = false;
	let failure: Error | undefined;
	const fail = (error: unknown) => {
		failure = error instanceof Error ? error : new Error(String(error));
		sink.fail(failure);
		ready.resolve();
		done.resolve();
	};
	const socket = new BunWebSocket(url, { headers });
	socket.onmessage = event => {
		try {
			const message = JSON.parse(String(event.data));
			sink.trace(message);
			if (message.type === readyType || message.message_type === readyType) {
				started = true;
				ready.resolve();
			}
			receive(message, done.resolve);
			const type = message.type ?? message.message_type ?? '';
			if (type === 'error' || /error|rate_limited|quota_exceeded|auth_error/.test(type))
				fail(new Error(`${type}: ${message.message ?? message.error ?? 'upstream failure'}`));
		} catch (error) {
			fail(error);
		}
	};
	socket.onerror = () => fail(new Error('WebSocket transport failed'));
	socket.onclose = event => {
		if (!ending) fail(new Error(`WebSocket closed ${event.code}: ${event.reason}`));
		else if (event.code !== 1000) fail(new Error(`WebSocket closed ${event.code}: ${event.reason}`));
		else done.resolve();
	};
	try {
		await within(ready.promise, 15_000, 'Timed out waiting for STT readiness');
		if (!started || failure) throw failure ?? new Error('STT did not initialize');
	} catch (error) {
		socket.close();
		throw error;
	}
	return {
		audio(pcm) {
			if (failure) throw failure;
			audio(socket, pcm);
		},
		async finish() {
			ending = true;
			if (failure) throw failure;
			end(socket);
			await done.promise;
			if (failure) throw failure;
		},
		close() {
			ending = true;
			socket.close();
		},
	};
}
