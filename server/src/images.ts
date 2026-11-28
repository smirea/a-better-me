import type { R2Bucket, R2Object, R2ObjectBody } from "@cloudflare/workers-types";
import type { SqlDriver } from "sync-engine/core";
import { IMAGE_MAX_BYTES, imageID, isJpeg } from "../../shared/images";
import { errorResponse } from "./http";

/**
 * Picture bytes between the app and the private bucket, apart from the database: a row lists a picture's id and the
 * bytes never sync. The Worker runs this itself, so a transfer never holds the `Space` object. See
 * `docs/decisions/images.md`.
 */

/** An id's bytes never change. */
const CACHE = "private, max-age=31536000, immutable";
const onlyNew = { onlyIf: new Headers({ "If-None-Match": "*" }) as never };
const jpegMetadata = { httpMetadata: { contentType: "image/jpeg", cacheControl: CACHE } };

/** `GET` and `HEAD` answer a picture; `PUT` stores one, once: a second upload of an id keeps the stored bytes. */
export async function imagesRoute(request: Request, bucket: R2Bucket): Promise<Response> {
  const id = imageID.safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return errorResponse(400, "id must be a lowercase UUID");
  switch (request.method) {
    case "GET":
    case "HEAD":
      return read(request, bucket, id.data);
    case "PUT":
      return put(request, bucket, id.data);
    default:
      return errorResponse(405, "A picture is read with GET and stored with PUT");
  }
}

async function read(request: Request, bucket: R2Bucket, key: string): Promise<Response> {
  const object: R2Object | R2ObjectBody | null =
    request.method === "HEAD"
      ? await bucket.head(key)
      : await bucket.get(key, { onlyIf: request.headers as never });
  if (!object) return errorResponse(404, "No such picture");
  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
    "Cache-Control": CACHE,
    ETag: object.httpEtag,
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    headers.set("Content-Length", String(object.size));
    return new Response(null, { headers });
  }
  if (!("body" in object)) return new Response(null, { status: 304, headers });
  headers.set("Content-Length", String(object.size));
  return new Response(object.body as unknown as ReadableStream, { headers });
}

async function put(request: Request, bucket: R2Bucket, key: string): Promise<Response> {
  const tooLarge = () => errorResponse(413, `At most ${IMAGE_MAX_BYTES} bytes`);
  if (Number(request.headers.get("content-length") ?? 0) > IMAGE_MAX_BYTES) return tooLarge();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > IMAGE_MAX_BYTES) return tooLarge();
  if (!isJpeg(bytes)) return errorResponse(415, "A picture is a JPEG");
  await bucket.put(key, bytes, { ...onlyNew, ...jpegMetadata });
  return Response.json({ ok: true });
}

/** How long a picture no supplement lists stays: an upload whose edit has not synced yet, and an undone delete. */
const GRACE_MS = 2 * 86_400_000;
/** When each unlisted picture was first seen unlisted, in the bucket itself, since nothing else on this path stores state. */
const ORPHANS_KEY = "orphans.json";

/**
 * Deletes the pictures no row has listed for `GRACE_MS`. `listed` is every picture id a row names now. There is no
 * delete route: removing a picture only takes its id off its row, and this collects the bytes later.
 */
export async function sweepImages(
  bucket: R2Bucket,
  listed: ReadonlySet<string>,
  now: Date,
): Promise<string[]> {
  const stored: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor });
    stored.push(
      ...page.objects.map((object) => object.key).filter((key) => imageID.safeParse(key).success),
    );
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const marks = ((await (await bucket.get(ORPHANS_KEY))?.json()) ?? {}) as Record<string, number>;
  const unlisted = stored.filter((key) => !listed.has(key));
  const since = Object.fromEntries(unlisted.map((key) => [key, marks[key] ?? now.getTime()]));
  const stale = unlisted.filter((key) => now.getTime() - since[key]! >= GRACE_MS);
  if (stale.length) await bucket.delete(stale);
  for (const key of stale) delete since[key];
  await bucket.put(ORPHANS_KEY, JSON.stringify(since), {
    httpMetadata: { contentType: "application/json" },
  });
  return stale;
}

/** The JSON columns that hold food snapshots, whose `image` keeps a food's picture for the log after the food changes. */
const SNAPSHOT_COLUMNS = {
  food_entries: ["food", "alterations"],
  food_favorites: ["food", "alterations"],
  recipes: ["ingredients"],
} as const;

/**
 * The picture ids the dumped tables list, for the sweep: supplements' pictures, foods', and every food snapshot's
 * `image`, however deep. A table that should list them and is missing is a bug, not an empty set.
 */
export function listedImages(tables: Record<string, unknown[]>): Set<string> {
  const rows = (table: string) => {
    const found = tables[table] as Record<string, unknown>[] | undefined;
    if (!found) throw new Error(`The dump has no ${table} table`);
    return found;
  };
  const listed = new Set(rows("supplements").flatMap((row) => JSON.parse(String(row.images)) as string[]));
  for (const row of rows("foods")) if (typeof row.image === "string") listed.add(row.image);
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== "object") return;
    for (const [key, inner] of Object.entries(value)) {
      if (key === "image" && typeof inner === "string") listed.add(inner);
      else collect(inner);
    }
  };
  for (const [table, columns] of Object.entries(SNAPSHOT_COLUMNS))
    for (const row of rows(table))
      for (const column of columns) {
        const json = row[column];
        if (typeof json === "string") collect(JSON.parse(json));
      }
  return listed;
}

/** How many rows one call moves. A Worker request on the free plan gets about 50 calls to the bucket. */
const MOVE_BATCH = 20;

/**
 * The one move of the pictures that synced as base64 rows of `supplement_images` into the bucket, under the same ids.
 * A row is deleted only after the bucket answered its put with the same size, and the table and its change log go once
 * it is empty, so a call that fails halfway is repeated safely. Answers how many rows are left, or null once there is
 * no table. The host calls it until then. Delete this once production has run it.
 */
export async function moveSupplementImageRows(
  { exec }: Pick<SqlDriver, "exec">,
  bucket: R2Bucket,
  batch = MOVE_BATCH,
): Promise<number | null> {
  if (
    !exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'supplement_images'").length
  )
    return null;
  const rows = exec("SELECT id, jpeg FROM supplement_images ORDER BY id LIMIT ?", [batch]);
  for (const row of rows) {
    const id = String(row.id);
    const bytes = Uint8Array.from(atob(String(row.jpeg)), (char) => char.charCodeAt(0));
    const object = await bucket.put(id, bytes, jpegMetadata);
    if (object?.size !== bytes.byteLength) throw new Error(`The bucket did not keep picture ${id}`);
    exec("DELETE FROM supplement_images WHERE id = ?", [id]);
  }
  const left = Number(exec("SELECT count(*) AS count FROM supplement_images")[0]!.count);
  if (left) return left;
  exec("DROP TABLE supplement_images");
  exec("DELETE FROM _changes WHERE \"table\" = 'supplement_images'");
  exec("DELETE FROM _log WHERE \"table\" = 'supplement_images'");
  return 0;
}
