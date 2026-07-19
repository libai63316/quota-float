import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const result = await build({
  entryPoints: [resolve("src/preview.tsx")],
  bundle: true,
  format: "iife",
  jsx: "automatic",
  minify: true,
  outdir: resolve("preview/.standalone-build"),
  platform: "browser",
  target: ["chrome110", "edge110", "safari16"],
  write: false,
});

const javascript = result.outputFiles.find((file) => file.path.endsWith(".js"));
const stylesheet = result.outputFiles.find((file) => file.path.endsWith(".css"));
if (!javascript || !stylesheet) throw new Error("Preview bundle is incomplete.");

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#e9edf3" />
    <title>Quota Float · 免安装预览</title>
    <style>${stylesheet.text}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${javascript.text}</script>
  </body>
</html>
`;

const output = resolve("preview/quota-float-preview.html");
await writeFile(output, html, "utf8");
console.log(`Standalone preview: ${output} (${Buffer.byteLength(html)} bytes)`);
