import { expect, test } from "bun:test";
import { handle } from "./api";
import { listedImages, moveSupplementImageRows, sweepImages } from "./images";
import { localBucket } from "./local-bucket";
import { testServer } from "./testing";

const jpeg = (...rest: number[]) => new Uint8Array([0xff, 0xd8, 0xff, ...rest]);
const ID = "0b0e7a52-6f0c-4b65-9d57-2a0d3c1e9f10";
const OTHER = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const DAY = 86_400_000;

test("a picture is stored once: a second upload of its id keeps the first bytes", async () => {
  const { app, config } = testServer();
  const call = (method: string, body?: Uint8Array<ArrayBuffer>) =>
    handle(
      new Request(`http://api.test/api/images?id=${ID}`, {
        method,
        headers: { authorization: `Bearer ${config.ownerToken}` },
        body,
      }),
      app,
    );
  expect((await call("GET")).status).toBe(404);
  expect((await call("PUT", jpeg(1))).status).toBe(200);
  expect((await call("PUT", jpeg(2))).status).toBe(200);
  expect(new Uint8Array(await (await call("GET")).arrayBuffer())).toEqual(jpeg(1));
  expect((await call("PUT", new Uint8Array([1, 2, 3]))).status).toBe(415);
});

test("a picture is deleted only once no row has listed it for two days, and one listed again is spared", async () => {
  const bucket = localBucket(null);
  for (const id of [ID, OTHER]) await bucket.put(id, jpeg());
  const at = (days: number) => new Date(Date.UTC(2026, 10, 19) + days * DAY);
  const stored = async () =>
    (await bucket.list()).objects
      .map((object) => object.key)
      .filter((key) => key !== "orphans.json");

  expect(await sweepImages(bucket, new Set([ID]), at(0))).toEqual([]);
  expect(await sweepImages(bucket, new Set([ID]), at(1.9))).toEqual([]);
  expect(await stored()).toEqual([ID, OTHER].sort());

  // Listed again before the grace ran out, then dropped again: the two days start over.
  expect(await sweepImages(bucket, new Set([ID, OTHER]), at(1.95))).toEqual([]);
  expect(await sweepImages(bucket, new Set([ID]), at(2.5))).toEqual([]);
  expect(await sweepImages(bucket, new Set([ID]), at(4.5))).toEqual([OTHER]);
  expect(await stored()).toEqual([ID]);
});

test("the sweep keeps the pictures supplements, foods, and the log's food snapshots list, and refuses a dump without one of them", () => {
  const THIRD = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
  const snapshot = (image?: string) => ({ name: "Swerve", source: "custom", nutrition: {}, ...(image && { image }) });
  const dump = {
    supplements: [{ images: `["${ID}"]` }, { images: "[]" }],
    foods: [{ image: OTHER }, { image: null }],
    food_entries: [{ food: JSON.stringify(snapshot(THIRD)), alterations: null }],
    food_favorites: [{ food: JSON.stringify(snapshot()), alterations: null }],
    recipes: [{ ingredients: JSON.stringify([{ id: "a", food: snapshot(OTHER) }]) }],
  };
  expect(listedImages(dump)).toEqual(new Set([ID, OTHER, THIRD]));
  expect(() => listedImages({ ...dump, foods: undefined } as never)).toThrow();
});

test("the move stores every old row in the bucket under its id before the table and its change log go", async () => {
  const { driver, bucket, phone } = testServer();
  driver.exec(
    "CREATE TABLE supplement_images (id TEXT PRIMARY KEY, jpeg TEXT NOT NULL, updated_at TEXT NOT NULL)",
  );
  for (const [id, bytes] of [
    [ID, jpeg(1)],
    [OTHER, jpeg(2, 3)],
  ] as const) {
    driver.exec("INSERT INTO supplement_images VALUES (?, ?, ?)", [
      id,
      Buffer.from(bytes).toString("base64"),
      "now",
    ]);
    driver.exec('INSERT INTO _changes ("table", id, seq, deleted) VALUES (?, ?, 0, 0)', [
      "supplement_images",
      id,
    ]);
  }

  expect(await moveSupplementImageRows(driver, bucket, 1)).toBe(1);
  expect(await moveSupplementImageRows(driver, bucket, 1)).toBe(0);
  expect(await moveSupplementImageRows(driver, bucket, 1)).toBeNull();

  const read = async (id: string) =>
    new Uint8Array(await new Response((await bucket.get(id))!.body as never).arrayBuffer());
  expect(await read(ID)).toEqual(jpeg(1));
  expect(await read(OTHER)).toEqual(jpeg(2, 3));
  expect(driver.exec("SELECT 1 FROM _changes WHERE \"table\" = 'supplement_images'")).toEqual([]);
  expect(await phone("supplements")).toEqual([]);
});
