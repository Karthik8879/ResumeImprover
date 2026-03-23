/**
 * One-off: extract plain text from PDFs into extension/resumes/*.txt
 * Run: node scripts/extract-resumes.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "extension/resumes");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const jobs = [
  {
    pdf: "d:/Downloads/Karthik_Sridhar_Resume_2025.pdf",
    txt: resolve(outDir, "karthik.txt"),
  },
  {
    pdf: "d:/Downloads/MUSKAN 2026 FINAL RESUMES/Muskan_Markam_Resume_2026 (1).pdf",
    txt: resolve(outDir, "muskan.txt"),
  },
];

for (const { pdf: pdfPath, txt } of jobs) {
  const buf = readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const data = await parser.getText();
  await parser.destroy();
  const text = (data.text || "").replace(/\r\n/g, "\n").trim();
  writeFileSync(txt, text, "utf8");
  console.log("Wrote", txt, `(${text.length} chars)`);
}
