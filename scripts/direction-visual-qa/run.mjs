// Renders REAL engine frames of a Direction that mixes cast verbs, a GLB model and the climbing hero. Run: node scripts/direction-visual-qa/run.mjs
// (Chromium + SwiftShader, no API key, no network). Output: tmp/direction-visual-qa/frames/*.png (gitignored).
import { build } from "vite";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = process.cwd(),
  qa = path.join(root, "scripts/direction-visual-qa"),
  out = path.join(root, "tmp/direction-visual-qa/dist"),
  framesDir = path.join(root, "tmp/direction-visual-qa/frames");
await build({
  configFile: false,
  root: qa,
  logLevel: "error",
  build: { outDir: out, emptyOutDir: true },
  resolve: { alias: { "@": path.join(root, "src") } },
});
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".glb": "model/gltf-binary",
  ".css": "text/css",
};
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = url.startsWith("/models/")
    ? path.join(root, "public", url)
    : path.join(out, url === "/" ? "index.html" : url);
  try {
    const b = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__done || window.__error, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__error);
if (err) {
  console.log("ERROR", err);
  process.exit(1);
}
const done = await page.evaluate(() => window.__done);
await mkdir(framesDir, { recursive: true });
for (const f of done.frames)
  await writeFile(
    path.join(framesDir, `t${String(f.t).replace(".", "_")}.png`),
    Buffer.from(f.png.split(",")[1], "base64"),
  );
console.log(
  JSON.stringify({ frames: done.frames.map((f) => f.t), report: done.report, total: done.total }),
);
await browser.close();
server.close();
