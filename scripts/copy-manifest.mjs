import { copyFileSync, mkdirSync, existsSync, cpSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");

if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
}

copyFileSync(resolve(root, "extension/manifest.json"), resolve(dist, "manifest.json"));
console.log("Copied manifest.json → dist/");

const resumesSrc = resolve(root, "extension/resumes");
const resumesDest = resolve(dist, "resumes");
if (existsSync(resumesSrc)) {
  mkdirSync(resumesDest, { recursive: true });
  cpSync(resumesSrc, resumesDest, { recursive: true });
  console.log("Copied resumes → dist/resumes/");
}
