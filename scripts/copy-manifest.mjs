import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "extension/manifest.json");
const dest = resolve(root, "dist/manifest.json");

if (!existsSync(resolve(root, "dist"))) {
  mkdirSync(resolve(root, "dist"), { recursive: true });
}
copyFileSync(src, dest);
console.log("Copied manifest.json → dist/");
