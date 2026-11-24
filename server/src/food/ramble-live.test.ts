import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import type { RambleOutline } from "./ramble";
import { Reader, wordsAfter, xaiTranscriber, type Heard, type SttSocket } from "./ramble-live";

const outline = (...names: string[]): RambleOutline => ({
  items: names.map((name) => ({
    kind: "food",
    name,
    amount: 0,
    unit: "",
    ref: null,
    scale: 1,
    copy: null,
    except: [],
    day: null,
    meal: "",
    time: "",
    options: false,
    said: name,
  })),
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

/** Lets every pending promise settle without moving the clock. */
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const wait = async (ms: number) => {
  jest.advanceTimersByTime(ms);
  await flush();
};
/** Whether `promise` settled without the clock moving. */
async function settledNow<T>(promise: Promise<T>) {
  let done = false;
  void promise.then(() => (done = true));
  await flush();
  return done;
}

/** A read per call that answers only when told to, with the foods its text names. */
function reads() {
  const calls: { text: string; answer(): void; fail(): void }[] = [];
  const read = (text: string) =>
    new Promise<RambleOutline>((resolve, reject) =>
      calls.push({
        text,
        answer: () => resolve(outline(...text.split(" and "))),
        fail: () => reject(new Error("both models failed")),
      }),
    );
  return { calls, read };
}

describe("Reader", () => {
  const timing = { debounceMs: 5, inflight: 2, settleCapMs: 500 };

  test("a burst of words is one read, and an older answer landing after a newer one is dropped", async () => {
    const { calls, read } = reads();
    const shown: string[][] = [];
    const reader = new Reader(
      read,
      { outline: (o) => shown.push(o.items.map((i) => i.name)), error: () => {} },
      timing,
    );
    reader.heard("eggs");
    reader.heard("eggs and toast");
    await wait(20);
    reader.heard("eggs and toast and coffee");
    await wait(20);
    expect(calls.map((call) => call.text)).toEqual(["eggs and toast", "eggs and toast and coffee"]);
    calls[1]!.answer();
    calls[0]!.answer();
    await flush();
    expect(shown).toEqual([["eggs", "toast", "coffee"]]);
  });

  test('words that stop mid-amount wait four debounces for the food, so "dinner, 200" is not read as dinner rolls', async () => {
    const { calls, read } = reads();
    const reader = new Reader(
      read,
      { outline: () => {}, error: () => {} },
      { ...timing, debounceMs: 10 },
    );
    reader.heard("dinner, 200");
    await wait(20);
    expect(calls).toEqual([]);
    reader.heard("dinner, 200 grams of tofu");
    await wait(20);
    expect(calls.map((call) => call.text)).toEqual(["dinner, 200 grams of tofu"]);
  });

  test("the stop reads the last words at once, past the in-flight limit, and settles on their answer", async () => {
    const { calls, read } = reads();
    const reader = new Reader(
      read,
      { outline: () => {}, error: () => {} },
      { ...timing, inflight: 1 },
    );
    reader.heard("eggs");
    await wait(20);
    const settled = reader.settle("eggs and toast");
    await flush();
    expect(calls.map((call) => call.text)).toEqual(["eggs", "eggs and toast"]);
    calls[1]!.answer();
    expect((await settled).items.map((item) => item.name)).toEqual(["eggs", "toast"]);
  });

  test("the last words already read settle at once without another read, punctuation aside", async () => {
    const { calls, read } = reads();
    const reader = new Reader(read, { outline: () => {}, error: () => {} }, timing);
    reader.heard("two eggs");
    await wait(20);
    calls[0]!.answer();
    await flush();
    const settling = reader.settle("Two eggs.");
    expect(await settledNow(settling)).toBe(true);
    expect((await settling).items.map((item) => item.name)).toEqual(["two eggs"]);
    expect(calls).toHaveLength(1);
  });

  test("a failed read is read again, and a second failure in a row ends the ramble", async () => {
    const { calls, read } = reads();
    const errors: Error[] = [];
    const reader = new Reader(read, { outline: () => {}, error: (e) => errors.push(e) }, timing);
    reader.heard("eggs");
    await wait(20);
    calls[0]!.fail();
    await flush();
    expect(calls.map((call) => call.text)).toEqual(["eggs", "eggs"]);
    expect(errors).toEqual([]);
    calls[1]!.fail();
    await flush();
    expect(errors.map((e) => e.message)).toEqual(["both models failed"]);
  });

  test("words committed after the stop are read as the last words, and closing ends a settle at once", async () => {
    const { calls, read } = reads();
    const reader = new Reader(read, { outline: () => {}, error: () => {} }, timing);
    const settled = reader.settle("eggs");
    reader.heard("eggs and toast");
    await flush();
    expect(calls.map((call) => call.text)).toEqual(["eggs", "eggs and toast"]);
    calls[0]!.answer();
    calls[1]!.answer();
    expect((await settled).items.map((item) => item.name)).toEqual(["eggs", "toast"]);

    const closing = new Reader(read, { outline: () => {}, error: () => {} }, timing);
    const settling = closing.settle("coffee");
    closing.close();
    expect(await settledNow(settling)).toBe(true);
    expect(await settling).toEqual(outline());
  });
});

describe("xaiTranscriber", () => {
  /** A socket shaped like a Worker's: listeners only, no `onmessage`. */
  function workerSocket() {
    const listeners: Record<string, ((event: never) => void)[]> = {};
    const sent: unknown[] = [];
    const socket: SttSocket = {
      binaryType: "blob",
      send: (data) => sent.push(data),
      close: () =>
        listeners.close?.forEach((listener) => listener({ code: 1000, reason: "" } as never)),
      addEventListener: (type: string, listener: (event: never) => void) =>
        (listeners[type] ??= []).push(listener),
    };
    const say = (message: object) =>
      listeners.message?.forEach((listener) =>
        listener({ data: JSON.stringify(message) } as never),
      );
    return { socket, sent, say };
  }

  test("a Worker's socket starts, partials replace the tail, and a pause's repeat of the utterance adds only its new words", async () => {
    const { socket, sent, say } = workerSocket();
    const heard: Heard[] = [];
    let done = false;
    const starting = xaiTranscriber(
      "key",
      async () => socket,
    )({
      heard: (words) => heard.push(words),
      done: () => (done = true),
      error: (error) => {
        throw error;
      },
    });
    await flush();
    say({ type: "transcript.created" });
    const stt = await starting;
    stt.audio(new Uint8Array(4));
    say({ type: "transcript.partial", text: "two eggs", is_final: false });
    say({ type: "transcript.partial", text: "two eggs,", is_final: true });
    say({ type: "transcript.partial", text: "and toast", is_final: false });
    say({
      type: "transcript.partial",
      text: "Two eggs and toast.",
      is_final: true,
      speech_final: true,
    });
    stt.end();
    say({ type: "transcript.done", text: "Two eggs and toast. Coffee." });
    expect(heard).toEqual([
      { committed: "", partial: "two eggs" },
      { committed: "two eggs,", partial: "" },
      { committed: "two eggs,", partial: "and toast" },
      { committed: "two eggs, and toast.", partial: "" },
      { committed: "two eggs, and toast. Coffee.", partial: "" },
    ]);
    expect(done).toBe(true);
    expect(sent).toEqual([new Uint8Array(4), '{"type":"audio.done"}']);
  });

  test("a prefix matches by words, case and punctuation aside", () => {
    expect(wordsAfter("Two eggs and toast.", "two eggs,")).toBe("and toast.");
    expect(wordsAfter("Three eggs and toast.", "two eggs,")).toBeNull();
    expect(wordsAfter("eggs", "")).toBe("eggs");
  });
});
