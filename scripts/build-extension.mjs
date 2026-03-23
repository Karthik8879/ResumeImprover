import * as esbuild from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  platform: "browser",
  logLevel: "info",
  sourcemap: true,
};

async function run() {
  const ctxBg = await esbuild.context({
    ...common,
    entryPoints: [resolve(root, "src/background/index.ts")],
    outfile: resolve(root, "dist/background.js"),
    format: "esm",
  });

  const ctxContent = await esbuild.context({
    ...common,
    entryPoints: [resolve(root, "src/content/index.ts")],
    outfile: resolve(root, "dist/content.js"),
    format: "iife",
  });

  if (watch) {
    await Promise.all([ctxBg.watch(), ctxContent.watch()]);
    console.log("Watching background + content…");
    return;
  }

  await ctxBg.rebuild();
  await ctxContent.rebuild();
  await ctxBg.dispose();
  await ctxContent.dispose();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
