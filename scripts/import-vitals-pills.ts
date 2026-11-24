/**
 * Imports the pills of the owner's `vitals` app as supplements: its SQLite file and the pictures in its S3 bucket.
 *
 *     OWNER_TOKEN=<token> AWS_ACCESS_KEY_ID=<id> AWS_SECRET_ACCESS_KEY=<secret> AWS_REGION=<region> \
 *       bun scripts/import-vitals-pills.ts --server <url> --db ~/code/vitals/data/vitals.sqlite [--dry-run]
 *
 * It writes through `POST /api/sync` as its own client, so every row takes the validators and reaches the phone like
 * any other write, then pulls the rows back and fails unless each one reads as it was sent. A picture's bytes go to
 * `PUT /api/images` before the supplement that lists it, and are read back the same way. Ids are hashed from the
 * vitals ids, and a supplement or tag the server already holds is left as it is, so a second run adds only what is
 * missing and never overwrites an edit made in the app. `--dry-run` does everything but write, the pictures included.
 * The mapping is in docs/decisions/nutrition.md, "Supplements". The picture conversion uses macOS's `sips`.
 */
import { Database } from "bun:sqlite";
import { S3Client } from "bun";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { IMAGES_PATH } from "../shared/images";
import { hashedId, run } from "./lib";

type Pill = {
  id: number;
  name: string;
  value: string | null;
  unit: string | null;
  note: string | null;
  url: string | null;
};
type Component = { pill_id: number; name: string; value: string | null; unit: string | null };
type Period = {
  id: number;
  pill_id: number;
  start_date: string;
  end_date: string | null;
  count: number;
  timing: string | null;
  days_of_week_json: string;
};
type Image = { id: number; pill_id: number; s3_path: string };
type Tag = { id: number; name: string; color: string; note: string | null; created_date: string };
type Link = { owner: number; tag_id: number };

export type Vitals = {
  pills: Pill[];
  components: Component[];
  periods: Period[];
  images: Image[];
  tags: Tag[];
  pillTags: Link[];
  periodTags: Link[];
};

type Values = Record<string, string | number | null>;
type Row = { table: "supplements" | "tags"; id: string; values: Values };
type Picture = { id: string; jpeg: Buffer };

const CLIENT = "vitals-import";
/** The long side the app's own photos have (`MealPhotoImage.maxPixels`), at which a Supplement Facts panel reads. */
const MAX_PIXELS = 1024;
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const id = (kind: "pill" | "image" | "tag", vitalsId: number) => hashedId("vitals", kind, vitalsId);

/** Sorted keys, the encoding iOS writes (`RowJSON`), so the app's first save of an imported row changes no column. */
const json = (value: unknown): string =>
  JSON.stringify(value, (_key, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.keys(inner)
            .toSorted()
            .map((key) => [key, inner[key]]),
        )
      : inner,
  );

/**
 * A vitals amount, which is text: "2", "1,000", or "100 million". The number leads, and words after it belong to the
 * unit, so "100 million" of "AFU" is 100 "million AFU".
 */
export function amountOf(
  value: string | null,
  unit: string | null,
): { amount?: number; unit?: string } {
  const match = /^\s*([\d,]*\.?\d+)\s*(.*)$/.exec(value ?? "");
  const words = [match ? match[2] : value, unit].map((part) => part?.trim()).filter(Boolean);
  return {
    ...(match && { amount: Number(match[1]!.replaceAll(",", "")) }),
    ...(words.length > 0 && { unit: words.join(" ") }),
  };
}

/**
 * The rows the pills become, pictures aside. A period's dates are kept as typed: vitals stops showing a pill on its
 * end date, but the owner's back-to-back periods end the day before the next starts, so the end is the last day taken.
 */
export function rowsOf(vitals: Vitals, now: string): { tags: Row[]; supplements: Row[] } {
  const tagIds = (links: Link[], owner: number) =>
    links.filter((link) => link.owner === owner).map((link) => id("tag", link.tag_id));
  const supplements = vitals.pills.map((pill): Row => {
    const serving = amountOf(pill.value, pill.unit);
    if (!serving.amount || !serving.unit)
      throw new Error(`${pill.name} has no serving: ${pill.value} ${pill.unit}`);
    const regimens = vitals.periods
      .filter((period) => period.pill_id === pill.id)
      .toSorted((a, b) => a.start_date.localeCompare(b.start_date))
      .map((period) => {
        const weekdays = (JSON.parse(period.days_of_week_json) as string[]).map(
          (day) => WEEKDAYS.indexOf(day) + 1,
        );
        if (weekdays.includes(0))
          throw new Error(`${pill.name} has an unknown weekday: ${period.days_of_week_json}`);
        const tags = tagIds(vitals.periodTags, period.id);
        return {
          start: period.start_date,
          ...(period.end_date && { end: period.end_date }),
          count: period.count,
          ...(period.timing && { timing: period.timing }),
          weekdays: weekdays.toSorted((a, b) => a - b),
          ...(tags.length > 0 && { tags }),
        };
      });
    return {
      table: "supplements",
      id: id("pill", pill.id),
      values: {
        name: pill.name,
        brand: null,
        url: pill.url?.trim() || null,
        serving: json({ quantity: serving.amount, unit: serving.unit }),
        components: json(
          vitals.components
            .filter((component) => component.pill_id === pill.id)
            .map((component) => ({
              name: component.name,
              ...amountOf(component.value, component.unit),
            })),
        ),
        regimens: json(regimens),
        note: pill.note?.trim() ?? "",
        images: json(
          vitals.images
            .filter((image) => image.pill_id === pill.id)
            .map((image) => id("image", image.id)),
        ),
        tags: json(tagIds(vitals.pillTags, pill.id)),
        created_at: now,
        updated_at: now,
      },
    };
  });
  const used = new Set([...vitals.pillTags, ...vitals.periodTags].map((link) => link.tag_id));
  const tags = vitals.tags
    .filter((tag) => used.has(tag.id))
    .map((tag): Row => ({
      table: "tags",
      id: id("tag", tag.id),
      values: {
        name: tag.name,
        color: tag.color.toLowerCase(),
        note: tag.note?.trim() ?? "",
        created_at: tag.created_date,
        updated_at: now,
      },
    }));
  return { tags, supplements };
}

export function readVitals(path: string): Vitals {
  const db = new Database(path, { readonly: true });
  const all = <T>(sql: string) => db.query(sql).all() as T[];
  return {
    pills: all("SELECT id, name, value, unit, note, url FROM pills ORDER BY id"),
    components: all(
      "SELECT pill_id, name, value, unit FROM pill_components ORDER BY pill_id, sort_order, id",
    ),
    periods: all(
      "SELECT id, pill_id, start_date, end_date, count, timing, days_of_week_json FROM pill_periods",
    ),
    images: all("SELECT id, pill_id, s3_path FROM pill_images ORDER BY pill_id, sort_order, id"),
    tags: all("SELECT id, name, color, note, created_date FROM tags ORDER BY id"),
    pillTags: all("SELECT pill_id AS owner, tag_id FROM pill_tags ORDER BY id"),
    periodTags: all("SELECT pill_period_id AS owner, tag_id FROM pill_period_tags ORDER BY id"),
  };
}

/** Any image as a JPEG no longer than `MAX_PIXELS`, never enlarged. */
function jpeg(bytes: Uint8Array, name: string, folder: string): Buffer {
  const source = join(folder, name);
  const output = join(folder, `${name}.jpg`);
  writeFileSync(source, bytes);
  const size = run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", source]);
  const longSide = Math.max(
    ...[...size.matchAll(/pixel(?:Width|Height): (\d+)/g)].map((match) => Number(match[1])),
  );
  const resize = longSide > MAX_PIXELS ? ["-Z", String(MAX_PIXELS)] : [];
  run([
    "sips",
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    "80",
    ...resize,
    source,
    "--out",
    output,
  ]);
  return readFileSync(output);
}

async function pictures(images: Image[]): Promise<Picture[]> {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
    throw new Error(
      "Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION to vitals' own, from its .env.local",
    );
  }
  const folder = mkdtempSync(join(tmpdir(), "vitals-pills-"));
  try {
    const rows: Picture[] = [];
    for (const image of images) {
      const { hostname: bucket, pathname } = new URL(image.s3_path);
      const s3 = new S3Client({
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
        region: AWS_REGION,
        bucket,
      });
      const bytes = await s3.file(decodeURIComponent(pathname.slice(1))).bytes();
      rows.push({ id: id("image", image.id), jpeg: jpeg(bytes, String(image.id), folder) });
    }
    return rows;
  } finally {
    rmSync(folder, { recursive: true });
  }
}

type SyncResponse = {
  space: string;
  snapshot: boolean;
  head: number;
  acked: number;
  rejected: { table: string; id: string; reason: string }[];
  rows: { table: string; id: string; deleted: number; values?: Values }[];
};

async function importPills(options: {
  server: string;
  token: string;
  db: string;
  dryRun: boolean;
}) {
  const headers = { authorization: `Bearer ${options.token}`, "content-type": "application/json" };
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${options.server}/api${path}`, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok)
      throw new Error(
        `${path} answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    return response.json();
  };
  const pictureRequest = async (picture: Picture, init: RequestInit) => {
    const response = await fetch(`${options.server}${IMAGES_PATH}?id=${picture.id}`, {
      ...init,
      headers: { authorization: headers.authorization, "content-type": "image/jpeg" },
    });
    if (!response.ok)
      throw new Error(`${init.method} picture ${picture.id} answered ${response.status}`);
    return response;
  };
  const sync = (cursor: number, writes: unknown[], space?: string): Promise<SyncResponse> =>
    request("/sync", { protocol: 2, client: CLIENT, cursor, writes, space });

  const held = (await request("/export")) as {
    tables: Record<string, { id: string }[] | undefined>;
  };
  if (!held.tables.tags)
    throw new Error("The server has no tags table. Deploy the schema that holds a pill first.");
  const heldIds = new Set([...held.tables.supplements!, ...held.tables.tags].map((row) => row.id));

  const now = new Date().toISOString();
  const vitals = readVitals(options.db);
  const all = rowsOf(vitals, now);
  const supplements = all.supplements.filter((row) => !heldIds.has(row.id));
  const tags = all.tags.filter((row) => !heldIds.has(row.id));
  const wanted = new Set(
    supplements.flatMap((row) => JSON.parse(row.values.images as string) as string[]),
  );
  const images = await pictures(vitals.images.filter((image) => wanted.has(id("image", image.id))));
  const imageBytes = images.reduce((sum, picture) => sum + picture.jpeg.length, 0);

  for (const row of supplements) {
    const regimens = JSON.parse(row.values.regimens as string) as unknown[];
    const parts = [
      `${(JSON.parse(row.values.components as string) as unknown[]).length} components`,
      `${regimens.length} ranges`,
      `${(JSON.parse(row.values.images as string) as unknown[]).length} pictures`,
      `${(JSON.parse(row.values.tags as string) as unknown[]).length} tags`,
      row.values.url ? "url" : "no url",
    ];
    console.log(`  ${row.values.name}: ${row.values.serving}, ${parts.join(", ")}`);
  }
  console.log(
    `${supplements.length} supplements (${all.supplements.length - supplements.length} already there), ${tags.length} tags, ` +
      `${images.length} pictures, ${(imageBytes / 1e6).toFixed(1)} MB, largest ${Math.max(0, ...images.map((picture) => picture.jpeg.length))}`,
  );
  if (options.dryRun) return console.log("Dry run: nothing was written.");

  // A cursor of 0 answers a snapshot's first page, which is read only for the head, the space, and this client's seq.
  const start = await sync(0, []);
  let seq = start.acked;
  let cursor = start.head;
  const send = async (rows: Row[]) => {
    if (!rows.length) return;
    const writes = rows.map((row) => ({ ...row, op: "put", seq: ++seq }));
    const { rejected, head } = await sync(cursor, writes, start.space);
    if (rejected.length) {
      throw new Error(
        `Refused: ${rejected.map((r) => `${r.table} ${r.id}: ${r.reason}`).join("; ")}`,
      );
    }
    cursor = head;
  };
  // Tags go first: a server that lacks this schema refuses them, before any supplement lands without its new columns.
  await send(tags);
  for (const supplement of supplements) {
    const own = new Set(JSON.parse(supplement.values.images as string) as string[]);
    for (const picture of images.filter((image) => own.has(image.id)))
      await pictureRequest(picture, { method: "PUT", body: new Uint8Array(picture.jpeg) });
    await send([supplement]);
  }

  const sent = [...tags, ...supplements];
  // A delta from the head before the writes is one response with every row written since, these among them.
  const delta = await sync(start.head, [], start.space);
  if (delta.snapshot)
    throw new Error("Written, but the server answered the read-back with a snapshot, not a delta.");
  const stored = new Map(delta.rows.map((row) => [`${row.table}/${row.id}`, row.values]));
  const wrong = sent.flatMap((row) => {
    const values = stored.get(`${row.table}/${row.id}`);
    const columns = Object.keys(row.values).filter(
      (column) => values?.[column] !== row.values[column],
    );
    return columns.length
      ? [`${row.table} ${row.id} (${row.values.name}): ${columns.join(", ")}`]
      : [];
  });
  for (const picture of images) {
    const stored = Buffer.from(
      await (await pictureRequest(picture, { method: "GET" })).arrayBuffer(),
    );
    if (!stored.equals(picture.jpeg)) wrong.push(`picture ${picture.id}`);
  }
  if (wrong.length)
    throw new Error(`Written, but these read back differently:\n${wrong.join("\n")}`);
  console.log(
    `Wrote and read back ${supplements.length} supplements, ${tags.length} tags, and ${images.length} pictures.`,
  );
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      server: { type: "string" },
      db: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  // The token comes from the environment, so it never shows in the process list.
  const token = process.env.OWNER_TOKEN;
  if (!values.server || !values.db || !token) {
    console.error(
      "Usage: OWNER_TOKEN=<token> bun scripts/import-vitals-pills.ts --server <url> --db <vitals.sqlite> [--dry-run]",
    );
    process.exit(2);
  }
  await importPills({
    server: values.server.replace(/\/$/, ""),
    token,
    db: values.db,
    dryRun: values["dry-run"],
  });
}
