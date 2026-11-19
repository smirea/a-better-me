import { z } from 'zod';

/** `GET`, `HEAD`, and `PUT /api/images?id=<picture id>`: a picture's bytes, which never sync. See `docs/decisions/images.md`. */
export const IMAGES_PATH = '/api/images';

/** A picture is a JPEG no longer than 1024 px, 60 to 230 KB. The cap bounds what one request buffers. */
export const IMAGE_MAX_BYTES = 1_500_000;

/** The id is also the bucket key, so it is the lowercase UUID the app makes and nothing a path could abuse. */
export const imageID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

export const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
