# Pictures

A row lists a picture's id and syncs like any other value. The picture's bytes never sync and never enter a database. Supplements' pictures are the only ones today; progress photos would use the same path ([Nutrition](nutrition.md#cut-or-deferred)). The design follows procrastimate's task attachments (`~/code/procrastimate/docs/decisions/images.md`), cut down to one owner, one size, and no files.

## Why the bytes left the database

- **They were 71% of a snapshot.** Pictures were base64 rows of a synced table, `supplement_images`. On 2026-11-19 a full pull of production was 4,551 rows and 10.85 MB, and 50 picture rows were 7.7 MB of it. Every device re-downloaded them whenever the engine took a snapshot, which it does after any schema change ([Sync](sync.md)), and every picture a device added was sent up and echoed back down.
- **A row caps a picture.** A Durable Object row holds 2 MB, so a picture had to stay under about 300 KB, which rules out a full-size photo.

## Data

- **A row lists ids.** `supplements.images` is the ids of a supplement's pictures, in order, lowercase UUIDs the app makes. The id is also the bucket key and the cache key, because a picture's bytes never change: a changed picture is a new id.
- **One size.** A picture is a JPEG no longer than 1024 px on its long side, 60 to 230 KB ([Nutrition](nutrition.md#supplements)). Every screen decodes it at the size it draws, so there is no thumbnail to store.

## Storage

- **A private R2 bucket, reached only through the Worker.** `a-better-me-images`, bound as `IMAGES`, holds one object per picture, keyed by its id. It has no public address and no S3 key exists for it. The asset bucket's signed S3 reads were not reused: that bucket is read-only catalog data shipped with a build, and a write key on the phone would be a second secret to rotate.
- **`/api/images?id=<id>`, owner token only.** `GET` and `HEAD` answer a picture, with `If-None-Match`. `PUT` stores one: the body must start as a JPEG (`415` otherwise) and be at most 1.5 MB (`413`). The Worker streams between the request and the bucket itself (`server/src/images.ts`), so a transfer never holds the `Space` object. Bot tokens cannot read pictures, because checking one needs the object; the agent API has no use for them yet.
- **Bytes are written once.** A `PUT` of an id the bucket holds keeps the stored bytes and answers 200, so a retry is harmless. `GET` answers `Cache-Control: private, max-age=31536000, immutable`.
- **Outside Cloudflare the bucket is a folder.** The Bun server and the tests use `localBucket` (`server/src/local-bucket.ts`), a folder beside the dev database (`.data/<checkout>.sqlite.images/`) that answers the part of R2's binding the routes use. `bun scripts/wrangler-dev.ts` runs the real binding locally.
- **Not in the backups.** The daily dump holds rows, so it lists picture ids and not their bytes. R2 is the only server copy; the phone's cache is a second one while it lasts.

## The phone

- **`PictureFiles` holds the bytes** (`app-ios/Sources/Core/Pictures/PictureFiles.swift`). A new picture is written to an upload queue in Application Support, then to a cache in Caches, and only then is the row that lists it written, so a row never names bytes no device has. Caches may be purged by the system, since every file in it can be fetched again.
- **Pictures go up before the rows that list them.** The sync client's `beforePush` uploads every queued picture before a sync that carries writes, and a failed upload fails that sync, which retries. An upload the server refuses for good (`400`, `413`, `415`) is dropped so it cannot block sync.
- **A picture shows from the cache, else the queue, else the server.** A fetched picture is cached, so it shows offline afterwards. One that neither the device nor the server has, as when the device is offline, shows the placeholder and is asked for again every 30 seconds while it is on screen.

## Deleting

- **Removing a picture takes its id off the row.** There is no delete route. The phone drops its own files at once.
- **A daily sweep collects the bytes.** After the backup, the `0 9 * * *` cron lists the bucket and reads the ids the dumped `supplements` rows list. A picture no row lists is marked in `orphans.json` in the bucket, and deleted once it has stayed unlisted for two days, which covers an upload whose edit has not synced yet. A picture listed again loses its mark. A dump without a `supplements` table fails the sweep instead of reading as "nothing is listed".

## The move

- **The server moved its rows on the first requests after the deploy.** `moveSupplementImageRows` runs in the `Space` object beside each request, 20 rows at a time because a free-plan request gets about 50 calls to the bucket. A row is deleted only after the bucket answered its put with the same size, and the table and its change log go once it is empty. A failed batch is reported and tried again; it never fails the request.
- **The phone moved its own rows at the next launch.** `LegacySupplementImages` writes each stored picture to the cache, queues the ones the server never received, and drops the table with its pending writes, which name a table the schema no longer has.
- **A build from before the move keeps showing the pictures it holds**, and a picture it adds is refused by the server and lost. The window is one app update.
- Delete both functions and their tests once the owner's phone runs a build with the move.
