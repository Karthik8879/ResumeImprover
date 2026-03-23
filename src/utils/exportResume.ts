import type { JobAnalysis } from "../types/analysis";
import type { jsPDF } from "jspdf";

/** Plain text resume section from tailored bullets. */
export function buildResumeText(bullets: string[], title?: string, company?: string): string {
  const header = [title, company].filter(Boolean).join(" — ");
  const lines = [
    header ? `${header}\n` : "",
    "Tailored highlights",
    "-----------------",
    ...bullets.map((b) => `• ${b}`),
  ];
  return lines.filter((l, i) => i > 0 || l).join("\n");
}

/** Markdown variant for download. */
export function buildResumeMarkdown(bullets: string[], title?: string, company?: string): string {
  const h = [title, company].filter(Boolean).join(" — ");
  const parts = [
    h ? `# ${h}\n` : "",
    "## Tailored highlights\n",
    ...bullets.map((b) => `- ${b}`),
  ];
  return parts.join("\n");
}

export function triggerDownload(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  triggerDownloadBlob(filename, blob);
}

export function triggerDownloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type PdfLineWriter = (text: string, bold?: boolean) => void;

/** Shared layout: plain text with newlines → jsPDF pages. */
function writePlainTextToPdf(doc: jsPDF, text: string, margin: number) {
  const lineHeight = 14;
  let y = margin;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxW = pageWidth - margin * 2;

  const addLine: PdfLineWriter = (line, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(line, maxW);
    for (const part of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin, y);
      y += lineHeight;
    }
  };

  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  for (const para of paragraphs) {
    const trimmed = para.trimEnd();
    if (trimmed === "") {
      y += lineHeight * 0.5;
      continue;
    }
    addLine(trimmed);
    y += 4;
  }
}

async function loadJsPDF() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "letter" });
}

/** Build a PDF Blob from arbitrary plain text (edited resume body). */
export async function pdfBlobFromPlainText(text: string): Promise<Blob> {
  const doc = await loadJsPDF();
  const margin = 48;
  writePlainTextToPdf(doc, text.trim() || " ", margin);
  return doc.output("blob");
}

/** Trigger browser download of a plain-text resume as PDF. */
export async function downloadPlainTextPdf(text: string, filename?: string): Promise<void> {
  const doc = await loadJsPDF();
  const margin = 48;
  writePlainTextToPdf(doc, text.trim() || " ", margin);
  doc.save(filename ?? `ai-job-assistant-resume-${Date.now()}.pdf`);
}

/**
 * PDF from structured analysis: prefers full tailored resume text, falls back to bullets.
 * @deprecated Prefer downloadPlainTextPdf(analysis.tailoredResumeFullText) from UI
 */
export async function downloadResumePdf(
  analysis: JobAnalysis,
  meta: { title?: string; company?: string }
): Promise<void> {
  const body =
    analysis.tailoredResumeFullText?.trim() ||
    buildResumeText(analysis.resumeBullets, meta.title, meta.company);
  await downloadPlainTextPdf(body);
}
