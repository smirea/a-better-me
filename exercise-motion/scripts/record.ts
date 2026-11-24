#!/usr/bin/env bun
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [out, hash = "ex=0&view=Angle", size = "1080,1080"] = process.argv.slice(2);
if (!out)
  throw new Error(
    'Usage: record.ts <out.mp4> ["ex=0&view=Angle&mode=Engagement&load=80"] [width,height]',
  );

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9500 + Math.floor(Math.random() * 400);
const work = await mkdtemp(join(tmpdir(), "exercise-motion-"));
const page = `file://${join(import.meta.dir, "../dist/exercise-motion.html")}#clean=1&play=0&${hash}`;
const browser = Bun.spawn(
  [
    chrome,
    "--headless=new",
    "--hide-scrollbars",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    `--window-size=${size}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(work, "profile")}`,
    page,
  ],
  { stdout: "ignore", stderr: "ignore" },
);

try {
  let socketUrl: string | undefined;
  for (let attempt = 0; attempt < 60 && !socketUrl; attempt++) {
    await Bun.sleep(200);
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      socketUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl;
    } catch {}
  }
  if (!socketUrl) throw new Error("Chrome did not open the viewer");
  const socket = new WebSocket(socketUrl);
  await new Promise((resolve) => (socket.onopen = resolve));
  let id = 0;
  const pending = new Map<number, (result: any) => void>();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    pending.get(message.id)?.(message.result);
  };
  const send = (method: string, params: object = {}) =>
    new Promise<any>((resolve) => {
      pending.set(++id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression: string) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

  await Bun.sleep(1500);
  const frames = Number(await evaluate(`document.getElementById("scrub").max`)) + 1;
  const fps = 30;
  for (let frame = 0; frame < frames; frame++) {
    // Seeks through the scrubber, the same path a person dragging it takes, then waits for that frame to be drawn.
    await evaluate(`new Promise(done => {
      const scrub = document.getElementById("scrub");
      scrub.value = "${frame}";
      scrub.dispatchEvent(new Event("input"));
      requestAnimationFrame(() => requestAnimationFrame(() => done(true)));
    })`);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await Bun.write(join(work, `${String(frame).padStart(4, "0")}.png`), Buffer.from(shot.data, "base64"));
  }
  // H.264 needs even dimensions, which a window size does not promise.
  const encode = Bun.spawn(
    ["ffmpeg", "-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(work, "%04d.png"), "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=white", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", out],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await encode.exited) !== 0) throw new Error("ffmpeg could not encode the frames");
  console.log(`${out}: ${frames} frames at ${fps} fps`);
} finally {
  browser.kill();
  await rm(work, { recursive: true, force: true });
}
