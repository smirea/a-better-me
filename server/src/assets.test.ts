import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assetRoutes } from "./assets";

const dir = mkdtempSync(join(tmpdir(), "assets-"));
mkdirSync(join(dir, "Images"));
writeFileSync(join(dir, "Images/a.webp"), "image");
writeFileSync(join(dir, "b.md"), "# B\n");
afterAll(() => rmSync(dir, { recursive: true }));

test("a pack holds its files back to back at the offsets its manifest lists, addressed by its sha256", async () => {
  const PACK_SHA = "ae14fe62bfab047974f07a844dff802e965a33f10d63713e40e866bc6a3e5bde";
  const VERSION = "78a7696b1b689b11";
  const serve = assetRoutes(dir);
  const get = (path: string) => serve(new Request(`http://localhost${path}`))!;

  expect(await get(`/assets/manifests/${VERSION}.json`).json()).toEqual({
    version: VERSION,
    packs: [
      {
        sha256: PACK_SHA,
        size: 9,
        files: [
          { path: "Images/a.webp", offset: 0, size: 5 },
          { path: "b.md", offset: 5, size: 4 },
        ],
      },
    ],
  });
  expect(await get(`/assets/blobs/${PACK_SHA}`).text()).toBe("image# B\n");
});
